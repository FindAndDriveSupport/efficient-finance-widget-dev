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
 *
 * NOTE ON POLICY PROMOTION (new):
 * Previously, any policy returned by GetPolicyStatusList with no existing
 * policy_events row was silently skipped — the assumption being every real
 * policy originates via createPolicy.js, which always creates a row first.
 * In practice some real Edith policies have no matching row (createPolicy.js
 * failure, a policy created directly in Edith outside the widget's normal
 * flow, etc.) — these were invisible to policy_events, and therefore to the
 * Funnel/Finance Reports' applications count, entirely.
 *
 * This adds a "promotion" path: for any orphaned policy, fetch its details,
 * pull the applicant's ID number (from the <IDNumber> tag under Persona
 * Detail/<Client>) and mobile number, and look them up against
 * dealer-reports-backend's seriti_leads D1 table (same database, populated
 * from Seriti's /Reporting endpoint — proven reliably synced). Originally
 * this matched against a separate seriti_intent_leads table sourced from
 * Seriti's dedicated Leads API, but that API returns empty results when
 * called server-to-server despite working fine from a browser (confirmed
 * via byte-identical token/URL/header comparison — likely an IP-allowlist
 * or bot-detection rule on Seriti's side we don't control), so this pivots
 * to the reliable data source instead. A match gives us both applicant_id
 * and dealer_key, letting us insert a new policy_events row instead of
 * discarding the policy. No match means we genuinely can't attribute it to
 * a dealer, and it's skipped exactly as before.
 */

const EARLIEST_ALLOWED_CREATE_DATE = new Date('2026-06-10T00:00:00');

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

export async function runFullBackfill(env, sinceDate = '10-jun-2026 00:00') {
  return processStatusSync(env, sinceDate);
}

const DEALER_FETCH_DELAY_MS = 1000; // be gentle on Edith between dealers

function sleepBetweenDealers(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Per-dealer-scoped backfill — loops through every dealer in D1 with a
// known branch_code, calling GetPolicyStatusList individually for EACH one
// (rather than the single branchCode: 'ALL' account-wide call the daily
// sync and runFullBackfill use). This is what actually lets the ID/mobile
// number promotion matching run against every dealer's own historical
// policies specifically, with per-dealer visibility into how many
// orphaned policies got matched via idNumber vs mobileNumber vs no match
// at all — rather than one opaque whole-account number.
export async function runPerDealerBackfill(env, sinceDate = '10-jun-2026 00:00', offset = 0, limit = null) {
  const { results: allDealers } = await env.DB.prepare(
    `SELECT id, branch_code FROM dealers WHERE branch_code IS NOT NULL AND branch_code != '' ORDER BY id`
  ).all();

  // Batching — even running in the background via ctx.waitUntil() has its
  // own time limit, which 36 dealers' worth of sequential Edith SOAP calls
  // (plus detail fetches for changed/orphaned policies) genuinely exceeds —
  // confirmed via a real "waitUntil() tasks did not complete... cancelled"
  // warning. Processing a SUBSET of dealers per call (via ?offset=&limit=)
  // keeps each individual run safely within both the request timeout and
  // the background task time budget — run this multiple times with
  // increasing offsets to cover everyone.
  const dealers = limit ? allDealers.slice(offset, offset + limit) : allDealers.slice(offset);

  console.log(JSON.stringify({
    level: 'info',
    type: 'per_dealer_backfill_start',
    dealerCount: dealers.length,
    totalDealerCount: allDealers.length,
    offset, limit,
    sinceDate,
    ts: new Date().toISOString(),
  }));

  const perDealerResults = [];
  let totalChecked = 0, totalUpdated = 0, totalInserted = 0, totalPromoted = 0, totalDetailFetches = 0;

  for (const dealer of dealers) {
    try {
      const result = await processStatusSync(env, sinceDate, dealer.branch_code);
      perDealerResults.push({ dealerId: dealer.id, branchCode: dealer.branch_code, ...result });

      totalChecked       += result.checked || 0;
      totalUpdated        += result.updated || 0;
      totalInserted        += result.inserted || 0;
      totalPromoted        += result.promoted || 0;
      totalDetailFetches   += result.detailFetches || 0;

      console.log(JSON.stringify({
        level: 'info',
        type: 'per_dealer_backfill_dealer_done',
        dealerId: dealer.id,
        branchCode: dealer.branch_code,
        ...result,
        ts: new Date().toISOString(),
      }));
    } catch (err) {
      logError('per_dealer_backfill_dealer_failed', { dealerId: dealer.id, branchCode: dealer.branch_code, message: err.message }, env);
      perDealerResults.push({ dealerId: dealer.id, branchCode: dealer.branch_code, error: err.message });
    }

    await sleepBetweenDealers(DEALER_FETCH_DELAY_MS);
  }

  const summary = {
    dealerCount: dealers.length,
    offset, limit,
    nextOffset: offset + dealers.length < allDealers.length ? offset + dealers.length : null,
    totalDealerCount: allDealers.length,
    totalChecked, totalUpdated, totalInserted, totalPromoted, totalDetailFetches,
    perDealer: perDealerResults,
  };

  console.log(JSON.stringify({
    level: 'info',
    type: 'per_dealer_backfill_done',
    dealerCount: dealers.length,
    nextOffset: summary.nextOffset,
    totalPromoted,
    ts: new Date().toISOString(),
  }));

  return summary;
}

async function processStatusSync(env, startDate, branchCode = 'ALL') {
  const { companyCode, companyPass, wsdlUrl } = selectEdithCredentials(env);

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_start',
    startDate,
    ts: new Date().toISOString(),
  }));

  let statusList;
  try {
    statusList = await getPolicyStatusList(wsdlUrl, companyCode, companyPass, startDate, branchCode);
  } catch (err) {
    logError('status_sync_list_failed', { message: err.message }, env);
    return { checked: 0, updated: 0, inserted: 0, promoted: 0, detailFetches: 0, error: err.message };
  }

  const beforeFilterCount = statusList.length;
  statusList = statusList.filter((entry) => {
    if (!entry.CreateDate) return true;
    return new Date(entry.CreateDate) >= EARLIEST_ALLOWED_CREATE_DATE;
  });
  const filteredOutCount = beforeFilterCount - statusList.length;
  if (filteredOutCount > 0) {
    console.log(JSON.stringify({
      level: 'info',
      type: 'status_sync_filtered_pre_cutoff',
      filteredOutCount,
      cutoff: EARLIEST_ALLOWED_CREATE_DATE.toISOString(),
      ts: new Date().toISOString(),
    }));
  }

  if (!statusList.length) {
    console.log(JSON.stringify({ level: 'info', type: 'status_sync_no_changes', ts: new Date().toISOString() }));
    return { checked: 0, updated: 0, inserted: 0, promoted: 0, detailFetches: 0 };
  }

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_changes_found',
    count: statusList.length,
    ts: new Date().toISOString(),
  }));

  const policyNumbers = statusList.map((p) => p.PolicyNumber).filter(Boolean);
  const existingRows = await getExistingRows(env, policyNumbers);

  // Split into three groups instead of two:
  //   1. needsDetail    — existing row, LastAccessDate moved, needs fresh details
  //   2. statusOnly     — existing row, nothing detail-level changed
  //   3. orphaned       — NO existing row at all — attempt promotion instead
  //      of silently discarding, per the new logic above.
  const needsDetail = [];
  const statusOnly = [];
  const orphaned = [];

  for (const entry of statusList) {
    const existing = existingRows.get(entry.PolicyNumber);

    if (!existing || existing.applicant_id == null) {
      orphaned.push(entry);
      continue;
    }

    const lastAccessMoved =
      !existing.last_access_date ||
      new Date(entry.LastAccessDate).getTime() !== new Date(existing.last_access_date).getTime();

    if (lastAccessMoved) {
      needsDetail.push(entry);
    } else {
      statusOnly.push(entry);
    }
  }

  if (orphaned.length > 0) {
    console.log(JSON.stringify({
      level: 'info',
      type: 'status_sync_orphaned_policies_found',
      count: orphaned.length,
      ts: new Date().toISOString(),
    }));
  }

  let updatedCount = 0;
  let insertedCount = 0;
  let promotedCount = 0;
  let detailFetchCount = 0;

  // ── Existing rows needing a fresh detail fetch ──────────────────────────
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
        applicantName: details?.ApplicantName ?? null,
        applicantMobile: details?.ApplicantMobile ?? null,
        applicantEmail: details?.ApplicantEmail ?? null,
        estimatedAmount: details?.EstimatedAmount ?? null,
        lastAccessDate: entry.LastAccessDate,
      });
      if (wrote === 'inserted') insertedCount++;
      else if (wrote === 'updated') updatedCount++;
    }
  }

  // ── Existing rows, no detail-level change ───────────────────────────────
  for (const entry of statusOnly) {
    const wrote = await upsertPolicyStatus(env, {
      policyNumber: entry.PolicyNumber,
      salesRef: entry.SalesReferenceNumber,
      branchCode: entry.BranchCode,
      applicationStatus: entry.Status,
      financeStatus: undefined,
      financeCompany: undefined,
      transactionStatus: undefined,
      applicantName: undefined,
      applicantMobile: undefined,
      applicantEmail: undefined,
      estimatedAmount: undefined,
      lastAccessDate: entry.LastAccessDate,
    });
    if (wrote === 'inserted') insertedCount++;
    else if (wrote === 'updated') updatedCount++;
  }

  // ── Orphaned policies — attempt promotion via ID number match ───────────
  for (let i = 0; i < orphaned.length; i += DETAIL_FETCH_CONCURRENCY) {
    const batch = orphaned.slice(i, i + DETAIL_FETCH_CONCURRENCY);
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

      // Try ID number first — more precise, since it's
      // an exact identity match rather than a phone number that could
      // theoretically be shared/reassigned. Falls back to mobile number
      // (low-intent leads) whenever there's no ID number at all, or the ID
      // didn't match anything — this covers leads that never reached
      // ID-verification but still may have gone on to a real policy.
      let match = details?.ApplicantIdNumber
        ? await findApplicantByIdNumber(env, details.ApplicantIdNumber)
        : null;
      let matchedVia = match ? 'idNumber' : null;

      if (!match && details?.ApplicantMobile) {
        match = await findApplicantByMobileNumber(env, details.ApplicantMobile);
        matchedVia = match ? 'mobileNumber' : null;
      }

      if (!match) {
        console.log(JSON.stringify({
          level: 'info',
          type: 'status_sync_promotion_no_match',
          policyNumber: entry.PolicyNumber,
          hadIdNumber: !!details?.ApplicantIdNumber,
          hadMobileNumber: !!details?.ApplicantMobile,
          ts: new Date().toISOString(),
        }));
        continue;
      }

      const financeType = await getDealerFinanceType(env, match.dealerKey);

      const promoted = await insertPolicyFromEdith(env, {
        policyNumber: entry.PolicyNumber,
        salesRef: entry.SalesReferenceNumber,
        branchCode: entry.BranchCode,
        dealerKey: match.dealerKey,
        applicantId: match.applicantId,
        financeType,
        applicationStatus: entry.Status,
        financeStatus: details.FinanceStatus,
        financeCompany: details.FinanceCompany,
        transactionStatus: details.TransactionStatus,
        applicantName: details.ApplicantName,
        applicantMobile: details.ApplicantMobile,
        applicantEmail: details.ApplicantEmail,
        estimatedAmount: details.EstimatedAmount,
        lastAccessDate: entry.LastAccessDate,
        createdAt: entry.CreateDate, // real Edith creation date — NOT "now"
        matchedVia,
      });

      if (promoted) {
        promotedCount++;
        console.log(JSON.stringify({
          level: 'info',
          type: 'status_sync_promoted',
          policyNumber: entry.PolicyNumber,
          dealerKey: match.dealerKey,
          matchedVia,
          ts: new Date().toISOString(),
        }));
      }
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    type: 'status_sync_done',
    updated: updatedCount,
    inserted: insertedCount,
    promoted: promotedCount,
    detailFetches: detailFetchCount,
    ts: new Date().toISOString(),
  }));

  return { checked: statusList.length, updated: updatedCount, inserted: insertedCount, promoted: promotedCount, detailFetches: detailFetchCount };
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

const SQL_IN_BATCH_SIZE = 100;

async function getExistingRows(env, policyNumbers) {
  const map = new Map();
  if (!policyNumbers.length) return map;

  for (let i = 0; i < policyNumbers.length; i += SQL_IN_BATCH_SIZE) {
    const batch = policyNumbers.slice(i, i + SQL_IN_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');
    const stmt = env.DB.prepare(
      `SELECT id, policy_number, applicant_id, last_access_date FROM policy_events WHERE policy_number IN (${placeholders})`
    ).bind(...batch);

    const { results } = await stmt.all();
    for (const row of results) {
      map.set(row.policy_number, row);
    }
  }
  return map;
}

// Looks up a real dealer_key/applicant_id pair by ID number, against
// dealer-reports-backend's seriti_intent_leads table (same D1 database —
// confirmed via wrangler.toml, both Workers bind the same postal-codes-db).
// Only high-intent leads carry an idNumber field at all — lowIntent leads
// never will, by Seriti's own API design, so this only ever checks 'high'.
// Matches against seriti_leads (Seriti's /Reporting-sourced data, already
// proven reliably synced) instead of seriti_intent_leads — the dedicated
// Leads API turned out to return empty results when called server-to-
// server (works fine from Swagger/browser, empty from this Worker —
// confirmed via byte-identical token/URL/header comparison, likely an
// IP-allowlist or bot-detection rule on Seriti's side outside our
// control). seriti_leads stores the NORMALIZED shape (PascalCase field
// names — IdNumber, MobileNumber — from seritiApiService.js's
// normaliseRow()), not Seriti's raw camelCase API response. This table
// doesn't distinguish low/high intent at all, so this now matches against
// every synced lead regardless of tier — a real tradeoff, since
// /Reporting's IdNumber is less consistently populated than the Leads API
// would have been (it reflects whatever was known at pre-qual time, not
// necessarily post-ID-verification) — but reliable beats blocked.
async function findApplicantByIdNumber(env, idNumber) {
  try {
    const row = await env.DB.prepare(`
      SELECT applicant_id, dealer_key FROM seriti_leads
      WHERE json_extract(data, '$.IdNumber') = ?
      ORDER BY synced_at DESC
      LIMIT 1
    `).bind(idNumber).first();

    if (!row) return null;
    return { applicantId: row.applicant_id, dealerKey: row.dealer_key };
  } catch (err) {
    logError('status_sync_promotion_lookup_failed', { idNumber, message: err.message }, env);
    return null;
  }
}

// Normalizes to the canonical SA mobile format: exactly 10 digits,
// starting with 0. Strips everything else (spaces, dashes, +27 country
// code, etc.) first. Returns null if the result doesn't conform — such a
// number is never attempted for matching rather than risking a false
// positive on a malformed value.
function normalizeMobileNumber(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');

  // 27XXXXXXXXX (11 digits, SA country code) -> 0XXXXXXXXX (10 digits)
  if (digits.length === 11 && digits.startsWith('27')) {
    digits = '0' + digits.slice(2);
  }
  // 9 digits with no leading 0 (country code + leading 0 both stripped
  // somewhere upstream) -> re-add the 0
  if (digits.length === 9 && !digits.startsWith('0')) {
    digits = '0' + digits;
  }

  return (digits.length === 10 && digits.startsWith('0')) ? digits : null;
}

// Fallback match for orphaned policies with no ID number (or no ID-number
// match) — checks low-intent leads by mobile number instead. Low-intent
// leads never carry an idNumber field at all (per Seriti's own schema), so
// this is the only viable match path for that whole tier of leads. A loose
// SQL LIKE pre-filter (last 9 digits) narrows candidates cheaply, with the
// precise normalized comparison done in JS to eliminate any false
// positives the loose filter might let through.
// Fallback match when ID number matching fails — same pivot to
// seriti_leads as findApplicantByIdNumber above, now matching everyone
// (not just a "low intent" tier, since that distinction doesn't exist in
// this table). A loose SQL LIKE pre-filter (last 9 digits) narrows
// candidates cheaply, with the precise normalized comparison done in JS to
// eliminate any false positives the loose filter might let through.
async function findApplicantByMobileNumber(env, rawMobileNumber) {
  const target = normalizeMobileNumber(rawMobileNumber);
  if (!target) return null;

  try {
    const { results } = await env.DB.prepare(`
      SELECT applicant_id, dealer_key, json_extract(data, '$.MobileNumber') as mobile
      FROM seriti_leads
      WHERE json_extract(data, '$.MobileNumber') LIKE ?
    `).bind(`%${target.slice(-9)}`).all();

    for (const row of results) {
      if (normalizeMobileNumber(row.mobile) === target) {
        return { applicantId: row.applicant_id, dealerKey: row.dealer_key };
      }
    }
    return null;
  } catch (err) {
    logError('status_sync_promotion_mobile_lookup_failed', { rawMobileNumber, message: err.message }, env);
    return null;
  }
}

// finance_type isn't available from either Edith endpoint — resolved from
// the matched dealer's own row instead (same D1 database, dealers table).
async function getDealerFinanceType(env, dealerKey) {
  try {
    const row = await env.DB.prepare(
      `SELECT finance_type FROM dealers WHERE id = ?`
    ).bind(dealerKey).first();
    return row?.finance_type || 'vehicle';
  } catch {
    return 'vehicle';
  }
}

async function upsertPolicyStatus(env, {
  policyNumber, applicationStatus,
  financeStatus, financeCompany, transactionStatus,
  applicantName, applicantMobile, applicantEmail, estimatedAmount,
  lastAccessDate,
}) {
  const now = new Date().toISOString();

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
  if (applicantName !== undefined) {
    sets.push('applicant_name = COALESCE(applicant_name, ?)');
    values.push(applicantName);
  }
  if (applicantMobile !== undefined) {
    sets.push('applicant_mobile = COALESCE(applicant_mobile, ?)');
    values.push(applicantMobile);
  }
  if (applicantEmail !== undefined) {
    sets.push('applicant_email = COALESCE(applicant_email, ?)');
    values.push(applicantEmail);
  }
  if (estimatedAmount !== undefined) {
    sets.push('estimated_amount = COALESCE(estimated_amount, ?)');
    values.push(estimatedAmount);
  }

  values.push(policyNumber);

  const result = await env.DB.prepare(
    `UPDATE policy_events SET ${sets.join(', ')} WHERE policy_number = ? AND applicant_id IS NOT NULL`
  ).bind(...values).run();

  return result.meta.changes > 0 ? 'updated' : 'skipped';
}

// Inserts a brand new policy_events row for a policy Edith knows about but
// our system never created a row for — resolved via ID-number or mobile-
// number match against seriti_leads (see findApplicantByIdNumber /
// findApplicantByMobileNumber above). created_at is set to the policy's
// REAL Edith creation date (entry.CreateDate), not "now" — otherwise a
// backfilled policy from weeks ago would show up in TODAY's date-range-
// filtered Funnel/Finance Reports numbers instead of its correct
// historical period. matchedVia ('idNumber' | 'mobileNumber') is persisted
// so the dashboard can separately track how many applications came from
// each matching path.
async function insertPolicyFromEdith(env, {
  policyNumber, salesRef, branchCode, dealerKey, applicantId, financeType,
  applicationStatus, financeStatus, financeCompany, transactionStatus,
  applicantName, applicantMobile, applicantEmail, estimatedAmount,
  lastAccessDate, createdAt, matchedVia,
}) {
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO policy_events (
        dealer_key, policy_number, applicant_id, sales_ref, branch_code, finance_type,
        created_at, status, application_status, finance_status, finance_company,
        transaction_status, applicant_name, applicant_mobile, applicant_email,
        estimated_amount, last_access_date, status_last_checked, matched_via
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      dealerKey, policyNumber, applicantId, salesRef || null, branchCode || null, financeType,
      createdAt || now, applicationStatus || null, financeStatus || null, financeCompany || null,
      transactionStatus || null, applicantName || null, applicantMobile || null, applicantEmail || null,
      estimatedAmount || null, lastAccessDate || null, now, matchedVia || null,
    ).run();
    return true;
  } catch (err) {
    logError('status_sync_promotion_insert_failed', { policyNumber, dealerKey, message: err.message }, env);
    return false;
  }
}

// ---------- Edith SOAP calls ----------

async function getPolicyStatusList(wsdlUrl, companyCode, companyPass, startDate, branchCode = 'ALL') {
  const xml = buildStatusListXML(companyCode, companyPass, startDate, branchCode);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyStatusList');
  return parseStatusListXML(rawText);
}

export async function debugFetchStatusListXML(env, branchCode = 'ALL', sinceDate = null) {
  const lastRun = sinceDate || await getLastRunDate(env);
  const { companyCode, companyPass, wsdlUrl } = selectEdithCredentials(env);
  const xml = buildStatusListXML(companyCode, companyPass, lastRun, branchCode);
  const rawText = await soapFetch(wsdlUrl, xml, 'GetPolicyStatusList');
  return { requestXml: xml, responseXml: rawText, startDate: lastRun, branchCode };
}

function buildStatusListXML(companyCode, companyPass, startDate, branchCode = 'ALL') {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:GetPolicyStatusList>
      <tem:credentials>
        <tem:CompanyCode>${esc(companyCode)}</tem:CompanyCode>
        <tem:CompanyPassword>${esc(companyPass)}</tem:CompanyPassword>
      </tem:credentials>
      <tem:salesCompanyCode>${esc(companyCode)}</tem:salesCompanyCode>
      <tem:branchCode>${esc(branchCode)}</tem:branchCode>
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
  const financeApps = [];
  const appBlocks = xml.matchAll(/<FinanceApplicationDetail>([\s\S]*?)<\/FinanceApplicationDetail>/gi);
  for (const b of appBlocks) {
    const block = b[1];
    const status = getTag(block, 'LatestApplicationStatus');
    if (!status) continue;
    financeApps.push({
      companyName: getTag(block, 'CompanyName'),
      status,
      date: getTag(block, 'LatestApplicationDate'),
    });
  }

  financeApps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const latestFinanceApp = financeApps[0] || null;

  const clientBlockMatch = xml.match(/<Client>([\s\S]*?)<\/Client>/i);
  const clientBlock = clientBlockMatch ? clientBlockMatch[1] : '';
  const firstName = getTag(clientBlock, 'FirstName');
  const lastName = getTag(clientBlock, 'LastName');

  return {
    FinanceStatus: getTag(xml, 'FinanceStatus') || latestFinanceApp?.status || null,
    FinanceCompany: getTag(xml, 'FinanceCompanyName') || latestFinanceApp?.companyName || null,
    TransactionStatus: getTag(xml, 'TransactionStatus'),
    PolicyNumber: getTag(xml, 'PolicyNumber'),
    ApplicantName: [firstName, lastName].filter(Boolean).join(' ') || null,
    ApplicantMobile: getTag(clientBlock, 'MobileNumber'),
    ApplicantEmail: getTag(clientBlock, 'EmailAddress'),
    // NEW — used only for the promotion-matching path (findApplicantByIdNumber),
    // never persisted onto policy_events itself (no id_number column exists,
    // and none is needed — this is a transient lookup key only).
    ApplicantIdNumber: getTag(clientBlock, 'IDNumber'),
    EstimatedAmount: getTag(xml, 'RetailPrice'),
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
