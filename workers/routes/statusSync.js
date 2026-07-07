/**
 * statusSync.js — Daily Edith policy status sync
 *
 * Called from worker.js's `scheduled()` export on a daily cron.
 * Updates policy_events with the latest application_status, finance_status,
 * and transaction_status pulled from Edith via GETPOLICYSTATUSLIST and
 * GETPOLICYDETAILS (SOAP), following the same conventions as createPolicy.js:
 *   - raw SOAP/XML over fetch(), tem: namespace, PolicyServicesV300
 *   - env.EDITH_COMPANY_CODE / EDITH_COMPANY_PASS / EDITH_WSDL_URL (dev)
 *   - env.EDITH_COMPANY_CODE_PROD / EDITH_COMPANY_PASS_PROD / EDITH_WSDL_URL_PROD (prod)
 *
 * NOTE ON ENVIRONMENT SELECTION:
 * createPolicy.js picks dev/prod credentials per-dealer via dealerConfig.edithEnv.
 * This sync job runs globally across all dealers/branches, so it needs a
 * single environment to query against. Defaults to PROD (env.EDITH_SYNC_ENV
 * can override to 'dev' for testing). If your dealer base is split across
 * both Edith environments in production, this job will need to loop over
 * both credential sets — flag this if that's the case.
 *
 * NOTE ON salesCompanyCode:
 * GETPOLICYSTATUSLIST requires a salesCompanyCode param. createPolicy.js
 * doesn't expose a distinct one — it reuses the same CompanyCode value
 * for FinanceApplication.CompanyCode. This job assumes salesCompanyCode ===
 * companyCode (the same value used in Credentials). Confirm this against
 * AD/Edith docs if that's wrong — if there's a separate
 * env.EDITH_SALES_COMPANY_CODE already in use elsewhere, swap it in below.
 *
 * NOTE ON XML TAG NAMES:
 * The Edith spec (word doc) describes GetPolicyStatusList/GetPolicyDetails
 * as returning "StatusList" (array) and "Policy" objects, but doesn't give
 * raw XML samples the way createPolicy.js's request body does. The parsing
 * functions below are written defensively (regex over repeating blocks)
 * but SHOULD be verified/adjusted against real raw XML — same as
 * createPolicy.js logs `rawText` before parsing. Do the same here on first
 * run against a real Edith response and adjust tag names if needed.
 */

import { DEALERS } from '../dealers/dealers.config.js';

const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 2000;
const DETAIL_FETCH_CONCURRENCY = 5;
const KV_LAST_RUN_KEY = 'edith:last_status_sync';

export async function runStatusSync(env) {
  const now = new Date();
  const lastRun = await getLastRunDate(env);
  const result = await processStatusSync(env, lastRun);
  await setLastRunDate(env, now);
  return result;
}

// One-time (or repeatable) historical backfill — queries Edith all the way
// back to a fixed early date instead of "since last run", so policies whose
// last edit predates this sync system ever running still get picked up.
// Does NOT touch the incremental KV timestamp, so it won't interfere with
// the daily cron's "since last run" window.
export async function runFullBackfill(env, sinceDate = '01-jan-2020 00:00') {
  return processStatusSync(env, sinceDate);
}

async function processStatusSync(env, startDate) {
  const { companyCode, companyPass, wsdlUrl } = selectEdithCredentials(env);

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_start',
    startDate,
    ts: new Date().toISOString(),
  }));

  let statusList;
  try {
    statusList = await getPolicyStatusList(wsdlUrl, companyCode, companyPass, startDate);
  } catch (err) {
    logError('status_sync_list_failed', { message: err.message }, env);
    return { checked: 0, updated: 0, inserted: 0, detailFetches: 0, error: err.message };
  }

  if (!statusList.length) {
    console.log(JSON.stringify({ level: 'info', type: 'status_sync_no_changes', ts: new Date().toISOString() }));
    return { checked: 0, updated: 0, inserted: 0, detailFetches: 0 };
  }

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_changes_found',
    count: statusList.length,
    ts: new Date().toISOString(),
  }));

  const policyNumbers = statusList.map((p) => p.PolicyNumber).filter(Boolean);
  const existingRows = await getExistingRows(env, policyNumbers);

  const needsDetail = [];
  const statusOnly = [];

  for (const entry of statusList) {
    const existing = existingRows.get(entry.PolicyNumber);
    const lastAccessMoved =
      !existing || !existing.last_access_date ||
      new Date(entry.LastAccessDate).getTime() !== new Date(existing.last_access_date).getTime();

    if (lastAccessMoved) {
      needsDetail.push(entry);
    } else {
      statusOnly.push(entry);
    }
  }

  let updatedCount = 0;
  let insertedCount = 0;
  let detailFetchCount = 0;

  for (let i = 0; i < needsDetail.length; i += DETAIL_FETCH_CONCURRENCY) {
    const batch = needsDetail.slice(i, i + DETAIL_FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((entry) => getPolicyDetails(wsdlUrl, companyCode, companyPass, entry.PolicyNumber))
    );

    for (let j = 0; j < results.length; j++) {
      const entry = batch[j];
      const result = results[j];

      if (result.status === 'rejected') {
        logError('status_sync_detail_failed', { policyNumber: entry.PolicyNumber, message: result.reason?.message }, env);
        continue;
      }

      const details = result.value;
      detailFetchCount++;

      const wrote = await upsertPolicyStatus(env, {
        policyNumber: entry.PolicyNumber,
        salesRef: entry.SalesReferenceNumber,
        branchCode: entry.BranchCode,
        applicationStatus: entry.Status,
        financeStatus: details?.FinanceStatus ?? null,
        financeCompany: details?.FinanceCompany ?? null,
        transactionStatus: details?.TransactionStatus ?? null,
        lastAccessDate: entry.LastAccessDate,
      });
      if (wrote === 'inserted') insertedCount++;
      else if (wrote === 'updated') updatedCount++;
    }
  }

  for (const entry of statusOnly) {
    const wrote = await upsertPolicyStatus(env, {
      policyNumber: entry.PolicyNumber,
      salesRef: entry.SalesReferenceNumber,
      branchCode: entry.BranchCode,
      applicationStatus: entry.Status,
      financeStatus: undefined,
      financeCompany: undefined,
      transactionStatus: undefined,
      lastAccessDate: entry.LastAccessDate,
    });
    if (wrote === 'inserted') insertedCount++;
    else if (wrote === 'updated') updatedCount++;
  }

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_done',
    updated: updatedCount,
    inserted: insertedCount,
    detailFetches: detailFetchCount,
    ts: new Date().toISOString(),
  }));

  return { checked: statusList.length, updated: updatedCount, inserted: insertedCount, detailFetches: detailFetchCount };
}

// ---------- Dealer resolution (for backfill inserts) ----------

function resolveDealerKeyByBranchCode(branchCode) {
  for (const [key, config] of Object.entries(DEALERS)) {
    if (config.branchCode === branchCode) return key;
  }
  return null;
}

// ---------- Credential selection (mirrors createPolicy.js) ----------

function selectEdithCredentials(env) {
  const isProd = (env.EDITH_SYNC_ENV || 'prod') === 'prod';
  return {
    companyCode: isProd ? env.EDITH_COMPANY_CODE_PROD : env.EDITH_COMPANY_CODE,
    companyPass: isProd ? env.EDITH_COMPANY_PASS_PROD : env.EDITH_COMPANY_PASS,
    wsdlUrl: isProd ? env.EDITH_WSDL_URL_PROD : env.EDITH_WSDL_URL,
  };
}

// ---------- KV helpers (reuses SERITI_CACHE binding) ----------

async function getLastRunDate(env) {
  const stored = await env.SERITI_CACHE.get(KV_LAST_RUN_KEY);
  if (stored) return stored;
  const fallback = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return formatEdithDate(fallback);
}

async function setLastRunDate(env, date) {
  await env.SERITI_CACHE.put(KV_LAST_RUN_KEY, formatEdithDate(date));
}

// Edith's expected format: dd-mmm-yyyy HH:nn (e.g. 07-aug-2009 14:15)
function formatEdithDate(date) {
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mmm = months[date.getUTCMonth()];
  const yyyy = date.getUTCFullYear();
  const HH = String(date.getUTCHours()).padStart(2, '0');
  const nn = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dd}-${mmm}-${yyyy} ${HH}:${nn}`;
}

// ---------- D1 helpers (policy_events table) ----------

const SQL_IN_BATCH_SIZE = 100; // stay well under SQLite's ~999 bound-parameter limit

async function getExistingRows(env, policyNumbers) {
  const map = new Map();
  if (!policyNumbers.length) return map;

  for (let i = 0; i < policyNumbers.length; i += SQL_IN_BATCH_SIZE) {
    const batch = policyNumbers.slice(i, i + SQL_IN_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');
    const stmt = env.DB.prepare(
      `SELECT id, policy_number, last_access_date FROM policy_events WHERE policy_number IN (${placeholders})`
    ).bind(...batch);

    const { results } = await stmt.all();
    for (const row of results) {
      map.set(row.policy_number, row);
    }
  }
  return map;
}

// Returns 'updated', 'inserted', or 'skipped' (if a new row was needed but
// the dealer couldn't be resolved from branchCode, e.g. unknown/retired
// branch code not present in dealers.config.js).
async function upsertPolicyStatus(env, {
  policyNumber, salesRef, branchCode, applicationStatus,
  financeStatus, financeCompany, transactionStatus, lastAccessDate,
}) {
  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    `SELECT id FROM policy_events WHERE policy_number = ? LIMIT 1`
  ).bind(policyNumber).first();

  if (existing) {
    const sets = ['application_status = ?', 'last_access_date = ?', 'status_last_checked = ?'];
    const values = [applicationStatus, lastAccessDate, now];

    if (financeStatus !== undefined) {
      sets.push('finance_status = ?');
      values.push(financeStatus);
    }
    if (financeCompany !== undefined) {
      sets.push('finance_company = ?');
      values.push(financeCompany);
    }
    if (transactionStatus !== undefined) {
      sets.push('transaction_status = ?');
      values.push(transactionStatus);
    }

    values.push(policyNumber);

    await env.DB.prepare(
      `UPDATE policy_events SET ${sets.join(', ')} WHERE policy_number = ?`
    ).bind(...values).run();

    return 'updated';
  }

  // No existing row — this policy predates (or was missed by) createPolicy.js's
  // write. Backfill a new row, resolving dealer_key from branchCode since
  // that's all Edith gives us here.
  const dealerKey = resolveDealerKeyByBranchCode(branchCode);
  if (!dealerKey) {
    logError('status_sync_unresolved_dealer', { policyNumber, branchCode }, env);
    return 'skipped';
  }

  await env.DB.prepare(`
    INSERT INTO policy_events (
      dealer_key, policy_number, sales_ref, branch_code,
      status, created_at,
      application_status, finance_status, finance_company, transaction_status,
      last_access_date, status_last_checked
    ) VALUES (?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    dealerKey,
    policyNumber,
    salesRef || null,
    branchCode || null,
    now,
    applicationStatus || null,
    financeStatus ?? null,
    financeCompany ?? null,
    transactionStatus ?? null,
    lastAccessDate || null,
    now,
  ).run();

  return 'inserted';
}

// ---------- Edith SOAP calls ----------

async function getPolicyStatusList(wsdlUrl, companyCode, companyPass, startDate) {
  const xml = buildStatusListXML(companyCode, companyPass, startDate);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyStatusList');
  return parseStatusListXML(rawText);
}

// Browser-debuggable variant — returns the raw XML text directly instead of
// parsing it, so it can be viewed in a browser tab with no terminal/log
// access needed. Called from the /api/debug/raw-status-list route.
export async function debugFetchStatusListXML(env) {
  const lastRun = await getLastRunDate(env);
  const { companyCode, companyPass, wsdlUrl } = selectEdithCredentials(env);
  const xml = buildStatusListXML(companyCode, companyPass, lastRun);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyStatusList');
  return { requestXml: xml, responseXml: rawText, startDate: lastRun };
}

function buildStatusListXML(companyCode, companyPass, startDate) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:GetPolicyStatusList>
      <tem:credentials>
        <tem:CompanyCode>${esc(companyCode)}</tem:CompanyCode>
        <tem:CompanyPassword>${esc(companyPass)}</tem:CompanyPassword>
      </tem:credentials>
      <tem:salesCompanyCode>${esc(companyCode)}</tem:salesCompanyCode>
      <tem:branchCode>ALL</tem:branchCode>
      <tem:startDate>${esc(startDate)}</tem:startDate>
      <tem:listType>EDIT</tem:listType>
    </tem:GetPolicyStatusList>
  </soap:Body>
</soap:Envelope>`;
}

async function getPolicyDetails(wsdlUrl, companyCode, companyPass, policyNumber) {
  const xml = buildPolicyDetailsXML(companyCode, companyPass, policyNumber);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyDetails');
  return parsePolicyDetailsXML(rawText);
}

// Browser-debuggable variant — returns raw XML directly for inspection.
export async function debugFetchPolicyDetailsXML(env, policyNumber) {
  const { companyCode, companyPass, wsdlUrl } = selectEdithCredentials(env);
  const xml = buildPolicyDetailsXML(companyCode, companyPass, policyNumber);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyDetails');
  return { requestXml: xml, responseXml: rawText };
}

function buildPolicyDetailsXML(companyCode, companyPass, policyNumber) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:GetPolicyDetails>
      <tem:Credentials>
        <tem:CompanyCode>${esc(companyCode)}</tem:CompanyCode>
        <tem:CompanyPassword>${esc(companyPass)}</tem:CompanyPassword>
      </tem:Credentials>
      <tem:PolicyNumber>${esc(policyNumber)}</tem:PolicyNumber>
      <tem:IncludeProducts>0</tem:IncludeProducts>
    </tem:GetPolicyDetails>
  </soap:Body>
</soap:Envelope>`;
}

async function soapFetch(wsdlUrl, xml, action) {
  let lastErr;
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(wsdlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `http://ws.edith.co.za/EdithServices/PolicyServicesV300/${action}`,
        },
        body: xml,
      });
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_LIMIT - 1) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

// ---------- XML parsing ----------
// TODO: verify tag names against a real logged response (console.log rawText
// the first time this runs, same as createPolicy.js does) and adjust regex
// below if Edith's actual element names differ.

function parseStatusListXML(xml) {
  const items = [];
  const blocks = xml.matchAll(/<PolicyStatus>([\s\S]*?)<\/PolicyStatus>/gi);
  for (const b of blocks) {
    const block = b[1];
    items.push({
      PolicyNumber: getTag(block, 'PolicyNumber'),
      SalesReferenceNumber: getTag(block, 'SalesReferenceNumber'),
      BranchCode: getTag(block, 'BranchCode'),
      Status: getTag(block, 'Status'),
      CreateDate: getTag(block, 'CreateDate'),
      LastAccessDate: getTag(block, 'LastAccessDate'),
      SubmitDate: getTag(block, 'SubmitDate'),
    });
  }
  return items;
}

function parsePolicyDetailsXML(xml) {
  // NB: Real Edith responses do NOT include top-level <FinanceStatus> or
  // <TransactionStatus> tags on the Policy object (confirmed against a live
  // response) — despite the spec PDF listing them as Policy fields.
  //
  // Finance decisions instead live nested under:
  //   <FinanceApplications><FinanceApplicationDetail>
  //     <CompanyName>WESBANK</CompanyName>
  //     <LatestApplicationStatus>DECLINED</LatestApplicationStatus>
  //     <LatestApplicationDate>...</LatestApplicationDate>
  //   </FinanceApplicationDetail>...
  // — one entry per finance house that's been applied to. We take the
  // entry with the most recent LatestApplicationDate that actually has a
  // status, and use its LatestApplicationStatus/CompanyName as our
  // finance_status / finance_company.
  //
  // TransactionStatus appears to genuinely not exist until later in the
  // deal lifecycle (it's a manually-set dropdown field) — if/when a real
  // response does include it, the getTag() fallback below will pick it up
  // without any code change needed.

  const financeApps = [];
  const appBlocks = xml.matchAll(/<FinanceApplicationDetail>([\s\S]*?)<\/FinanceApplicationDetail>/gi);
  for (const b of appBlocks) {
    const block = b[1];
    const status = getTag(block, 'LatestApplicationStatus');
    if (!status) continue; // not yet applied to this finance house
    financeApps.push({
      companyName: getTag(block, 'CompanyName'),
      status,
      date: getTag(block, 'LatestApplicationDate'),
    });
  }

  // Most recent by date (string ISO comparison works fine here)
  financeApps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const latestFinanceApp = financeApps[0] || null;

  return {
    // Prefer top-level tags — confirmed present once a deal progresses far
    // enough (e.g. PAID OUT / DELIVERED). Fall back to the nested
    // FinanceApplications array for earlier-stage deals where the
    // top-level fields haven't been set yet.
    FinanceStatus: getTag(xml, 'FinanceStatus') || latestFinanceApp?.status || null,
    FinanceCompany: getTag(xml, 'FinanceCompanyName') || latestFinanceApp?.companyName || null,
    TransactionStatus: getTag(xml, 'TransactionStatus'),
    PolicyNumber: getTag(xml, 'PolicyNumber'),
  };
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, 'i'));
  return match ? match[1].trim() : null;
}

// ---------- Shared helpers ----------

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logError(type, data, env, context = {}) {
  console.error(JSON.stringify({
    level: 'error',
    type,
    ...context,
    data,
    ts: new Date().toISOString(),
    env: env.WORKER_ENV,
  }));
}