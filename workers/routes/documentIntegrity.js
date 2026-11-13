/**
 * documentIntegrity.js — document authenticity / consistency checks.
 *
 * IMPORTANT: these produce RISK FLAGS FOR A HUMAN TO REVIEW. They cannot prove a
 * document is genuine or forged, and a flag must never decline an application on
 * its own. Findings are stored server-side and are NOT returned to the applicant.
 *
 * Signals:
 *   1. SA ID number validity (format, check digit, plausible birth date, age)
 *   2. File metadata (PDF producer / editing tool / modified-after-created, image editor tags)
 *   3. Arithmetic inside a document (payslip gross - deductions = net; statement balances)
 *   4. Visual tampering observations reported by the vision model (capped at "medium")
 *   5. Cross-document consistency (same ID number and surname, payslip net paid into the account)
 *
 * Names and ID numbers are stored only as HMAC hashes (PROGRESS_PEPPER).
 */

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

// ── SA ID ─────────────────────────────────────────────────────

/** Format, check digit and plausibility of a 13-digit South African ID number. */
export function saIdDetails(id, now = new Date()) {
  const s = String(id ?? '').replace(/\D/g, '');
  const out = { valid: false, reason: null };
  if (!/^\d{13}$/.test(s)) return { ...out, reason: 'format' };

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = +s[12 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  if (sum % 10 !== 0) return { ...out, reason: 'check_digit' };

  const yy = +s.slice(0, 2), mm = +s.slice(2, 4), dd = +s.slice(4, 6);
  const century = yy > now.getUTCFullYear() % 100 ? 1900 : 2000;
  const dob = new Date(Date.UTC(century + yy, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) return { ...out, reason: 'birth_date' };

  const age = Math.floor((now - dob) / (365.25 * 86_400_000));
  return {
    valid: true, reason: null, age,
    dob: dob.toISOString().slice(0, 10),
    gender: +s.slice(6, 10) >= 5000 ? 'male' : 'female',
    citizen: s[10] === '0',
  };
}

// ── File metadata ─────────────────────────────────────────────

const MAX_SCAN_BYTES = 6 * 1024 * 1024;
const HEAVY_EDITORS = /photoshop|illustrator|canva|ilovepdf|smallpdf|sejda|pdfescape|inkscape|gimp|pixelmator|paint\.net|online2pdf|pdf24|foxit|nitro|pdf-?xchange|acrobat pro|pdfelement|wondershare/i;
const OFFICE_EDITORS = /microsoft.{0,10}word|libreoffice|openoffice|wps|google docs|pages/i;

function decodeHead(b64) {
  try {
    const slice = b64.slice(0, Math.ceil((MAX_SCAN_BYTES * 4) / 3));
    return atob(slice.slice(0, slice.length - (slice.length % 4)));
  } catch { return ''; }
}
function decodeTail(b64) {
  try {
    const take = 600_000; // ~450 KB: PDF trailers / Info dictionaries sit at the end
    if (b64.length <= take) return '';
    const start = b64.length - take - ((b64.length - take) % 4);
    return atob(b64.slice(start));
  } catch { return ''; }
}

const pdfDate = (s) => (s && /^\d{14}/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)) : null);

export function metadataFindings(file, category) {
  const out = [];
  const text = decodeHead(file.data) + '\n' + decodeTail(file.data);
  const tag = (re) => { const m = re.exec(text); return m ? m[1].replace(/[^\x20-\x7e]/g, '').trim().slice(0, 60) : null; };

  if (file.mediaType === 'application/pdf') {
    const producer = tag(/\/Producer\s*\(([^)]{1,120})\)/) || tag(/<pdf:Producer>([^<]{1,120})</);
    const creator = tag(/\/Creator\s*\(([^)]{1,120})\)/) || tag(/<xmp:CreatorTool>([^<]{1,120})</);
    const tool = `${producer || ''} ${creator || ''}`;
    if (HEAVY_EDITORS.test(tool)) out.push({ code: 'file_edited_with_editor', severity: 'medium', detail: `PDF produced by an editing tool: ${(producer || creator)}` });
    else if (OFFICE_EDITORS.test(tool) && (category === 'bank_transactions' || category === 'bank_statement')) {
      out.push({ code: 'bank_statement_made_in_office_tool', severity: 'medium', detail: `Bank statement PDF produced by ${(producer || creator)}` });
    } else if (OFFICE_EDITORS.test(tool)) out.push({ code: 'file_made_in_office_tool', severity: 'low', detail: `PDF produced by ${(producer || creator)}` });

    const created = pdfDate(tag(/\/CreationDate\s*\(D:(\d{14})/)), modified = pdfDate(tag(/\/ModDate\s*\(D:(\d{14})/));
    if (created && modified && modified - created > 5 * 60_000) {
      out.push({ code: 'file_modified_after_creation', severity: 'low', detail: 'PDF was modified after it was created' });
    }
    if ((text.match(/%%EOF/g) || []).length > 1 && /\/Prev\s+\d+/.test(text)) {
      out.push({ code: 'file_incrementally_updated', severity: 'low', detail: 'PDF has been saved over with later edits' });
    }
  } else {
    const head = text.slice(0, 200_000);
    const m = /(Adobe Photoshop[^\x00]{0,20}|GIMP[^\x00]{0,15}|Canva|Pixelmator|Paint\.NET|Snapseed|Lightroom)/i.exec(head);
    if (m) out.push({ code: 'image_edited_with_editor', severity: 'medium', detail: `Image tagged by an editing tool: ${m[1].replace(/[^\x20-\x7e]/g, '').slice(0, 40)}` });
  }
  return out;
}

// ── Within-document checks ────────────────────────────────────

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function payslipChecks(raw) {
  const out = [];
  for (const p of Array.isArray(raw?.payslips) ? raw.payslips : []) {
    const gross = num(p.grossMonthlySalary), ded = num(p.totalDeductions), net = num(p.nettPay);
    if (gross && ded != null && net && !near(gross - ded, net, Math.max(5, gross * 0.01))) {
      out.push({ code: 'payslip_arithmetic', severity: 'high', detail: 'Payslip gross minus deductions does not equal net pay' });
      break;
    }
  }
  return out;
}

function bankStatementChecks(raws) {
  const out = [];
  for (const raw of raws) for (const s of Array.isArray(raw?.statements) ? raw.statements : []) {
    const open = num(s.openingBalance), close = num(s.closingBalance), cr = num(s.totalCredits), dr = num(s.totalDebits);
    if (open != null && close != null && cr != null && dr != null && !near(open + cr - dr, close, Math.max(2, Math.abs(close) * 0.002))) {
      out.push({ code: 'statement_balance_mismatch', severity: 'high', detail: 'Statement opening balance + credits - debits does not equal the closing balance' });
      break;
    }
  }
  return out;
}

function visualFindings(raws) {
  const out = [];
  for (const raw of raws) for (const o of Array.isArray(raw?.tamperObservations) ? raw.tamperObservations : []) {
    const text = String(o?.observation ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) continue;
    // The model can describe what looks odd but cannot prove tampering: never above "medium".
    out.push({ code: 'visual_anomaly', severity: o.severity === 'low' ? 'low' : 'medium', detail: text });
    if (out.length >= 5) return out;
  }
  return out;
}

export function overallRisk(findings) {
  const sevs = findings.map((f) => SEVERITY_RANK[f.severity] || 0);
  if (sevs.includes(3)) return 'high';
  const med = sevs.filter((s) => s === 2).length, low = sevs.filter((s) => s === 1).length;
  if (med >= 1 || low >= 3) return 'medium';
  return low ? 'low' : 'none';
}

// ── Hashing / facts ───────────────────────────────────────────

async function hash(env, v) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PROGRESS_PEPPER || 'extract'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(v)));
  return [...new Uint8Array(sig)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const nameTokens = (s) => [...new Set(String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter((t) => t.length >= 3))];
const hashTokens = (env, s) => Promise.all(nameTokens(s).map((t) => hash(env, `n:${t}`)));

/**
 * Builds findings + hashed facts for one extraction request.
 * `raws` are the raw model outputs (one, or one per file for per-file categories).
 */
export async function buildIntegrity(env, category, raws, files, fields, declaredId) {
  const findings = [];
  const facts = {};

  for (const f of files) findings.push(...metadataFindings(f, category));
  findings.push(...visualFindings(raws));

  if (category === 'id' || category === 'drivers_licence') {
    const rawDoc = (raws[0]?.documents || []).find((d) => d.idNumber || d.surname) || {};
    const id = String(rawDoc.idNumber ?? '').replace(/\D/g, '');
    const isPassport = rawDoc.documentType === 'passport';
    if (id && !isPassport) {
      const d = saIdDetails(id);
      if (!d.valid) findings.push({ code: 'id_number_invalid', severity: 'high', detail: `ID number failed validation (${d.reason})` });
      else if (d.age < 18) findings.push({ code: 'id_underage', severity: 'high', detail: 'ID number indicates the applicant is under 18' });
      else if (d.age > 100) findings.push({ code: 'id_implausible_age', severity: 'medium', detail: 'ID number indicates an age over 100' });
      facts.idHash = await hash(env, `id:${id}`);
    }
    // The ID number the applicant typed before uploading vs the one printed on this document.
    const declared = String(declaredId ?? '').replace(/\D/g, '');
    if (id && !isPassport && declared.length === 13 && declared !== id) {
      const bothValid = saIdDetails(id).valid && saIdDetails(declared).valid;
      findings.push({
        code: 'declared_id_differs_from_document',
        severity: bothValid ? 'high' : 'medium', // two valid but different numbers = a different person; one invalid = probably a typo
        detail: bothValid ? 'The ID number entered differs from the (valid) ID number on the document' : 'The ID number entered differs from the ID number read from the document (one is not a valid ID number)',
      });
    }
    if (category === 'id' && rawDoc.documentType === 'not_an_id') findings.push({ code: 'not_an_id_document', severity: 'medium', detail: 'Uploaded ID file does not look like an ID document' });
    facts.surnameTokens = await hashTokens(env, rawDoc.surname);
  }

  if (category === 'payslip') {
    findings.push(...payslipChecks(raws[0]));
    const slips = raws[0]?.payslips || [];
    const latest = [...slips].sort((a, b) => String(b.payDate || '').localeCompare(String(a.payDate || '')))[0];
    if (latest) {
      facts.net = num(latest.nettPay);
      facts.gross = num(latest.grossMonthlySalary);
      facts.nameTokens = await hashTokens(env, latest.employeeName);
    }
  }

  if (category === 'bank_statement') {
    findings.push(...bankStatementChecks(raws));
    const st = (raws[0]?.statements || []).find((s) => s.accountHolderName);
    if (st) facts.nameTokens = await hashTokens(env, st.accountHolderName);
  }

  if (category === 'bank_transactions') {
    facts.salaryCredits = raws.flatMap((r) => (Array.isArray(r?.salaryCredits) ? r.salaryCredits : []).map((c) => num(c.amount)).filter(Boolean)).slice(0, 12);
    facts.read = true;
  }

  return { findings, facts, risk: overallRisk(findings) };
}

export async function saveCheck(env, sessionId, category, integrity) {
  if (!env.DB) return;
  try {
    await env.DB.prepare('INSERT INTO document_checks (session_id, category, risk, findings, facts) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, category, integrity.risk, JSON.stringify(integrity.findings), JSON.stringify(integrity.facts)).run();
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', type: 'document_check_write_failed', error: err.message }));
  }
}

// ── Review (per-document findings + cross-document checks) ────

export async function reviewSession(env, sessionId) {
  const { results } = await env.DB.prepare(
    `SELECT category, risk, findings, facts, created_at FROM document_checks
     WHERE session_id = ? AND category != 'submission' ORDER BY created_at ASC`,
  ).bind(sessionId).all();

  const latest = {};
  for (const r of results || []) latest[r.category] = { ...r, findings: JSON.parse(r.findings), facts: JSON.parse(r.facts) }; // newest wins

  const findings = [];
  for (const [category, r] of Object.entries(latest)) for (const f of r.findings) findings.push({ ...f, category });

  const add = (code, severity, detail, category) => findings.push({ code, severity, detail, category: category || 'cross' });

  // The same checks run for the applicant's documents and, separately, the spouse's (categories prefixed "spouse_").
  for (const prefix of ['', 'spouse_']) {
    const who = prefix ? "spouse's " : '';
    const id = latest[`${prefix}id`]?.facts, lic = latest[`${prefix}drivers_licence`]?.facts, slip = latest[`${prefix}payslip`]?.facts, bank = latest[`${prefix}bank_statement`]?.facts, tx = latest[`${prefix}bank_transactions`]?.facts;

    if (id?.idHash && lic?.idHash && id.idHash !== lic.idHash) add(`${prefix}id_differs_from_licence`, 'high', `ID number on the ${who}driver's licence differs from the ${who}ID document`);

    if (id?.surnameTokens?.length) {
      for (const [label, f] of [['drivers_licence', lic], ['payslip', slip], ['bank_statement', bank]]) {
        const theirs = f?.nameTokens || f?.surnameTokens;
        if (theirs?.length && !theirs.some((t) => id.surnameTokens.includes(t))) add(`${prefix}surname_differs_${label}`, 'medium', `Name on the ${who}${label.replace('_', ' ')} does not match the ${who}ID document surname`);
      }
    }

    if (slip?.net && tx?.read) {
      const matched = (tx.salaryCredits || []).some((c) => Math.abs(c - slip.net) <= Math.max(50, slip.net * 0.03));
      if (!matched) add(`${prefix}payslip_net_not_in_bank`, (tx.salaryCredits || []).length ? 'medium' : 'low', `No salary deposit on the ${who}bank statements matches the ${who}payslip net pay`);
    }
  }

  // The same person's ID uploaded for both applicant and spouse.
  const mine = latest.id?.facts, theirs = latest.spouse_id?.facts;
  if (mine?.idHash && theirs?.idHash && mine.idHash === theirs.idHash) add('spouse_id_same_as_applicant', 'high', "The spouse's ID document has the same ID number as the applicant's");

  return { risk: overallRisk(findings), findings, documents: Object.keys(latest) };
}

/** Called after a successful submission: records the review once so finance can list flagged applications. */
export async function recordSubmissionReview(env, sessionId, salesRef, submittedId, submittedSpouseId) {
  if (!env.DB || !/^[A-Za-z0-9-]{8,64}$/.test(String(sessionId || ''))) return null;
  try {
    const review = await reviewSession(env, sessionId);
    if (!review.documents.length) return null;
    // The ID that was actually submitted vs the ID read from the uploaded documents.
    const sub = String(submittedId ?? '').replace(/\D/g, '');
    if (sub.length === 13) {
      const submittedHash = await hash(env, `id:${sub}`);
      const rows = await env.DB.prepare(`SELECT category, facts FROM document_checks WHERE session_id = ? AND category IN ('id','drivers_licence') ORDER BY created_at DESC`).bind(sessionId).all();
      const seen = new Set();
      for (const r of rows.results || []) {
        if (seen.has(r.category)) continue; seen.add(r.category);
        const h = JSON.parse(r.facts).idHash;
        if (h && h !== submittedHash) review.findings.push({ code: 'submitted_id_differs_from_document', severity: 'high', detail: `The ID number submitted differs from the ID number on the ${r.category.replace('_', ' ')}`, category: r.category });
      }
    }
    // Spouse applications: the spouse ID that was submitted vs the one read from the spouse's ID document.
    const spouseSub = String(submittedSpouseId ?? '').replace(/\D/g, '');
    if (spouseSub.length === 13) {
      const h = await hash(env, `id:${spouseSub}`);
      const row = await env.DB.prepare(`SELECT facts FROM document_checks WHERE session_id = ? AND category = 'spouse_id' ORDER BY created_at DESC LIMIT 1`).bind(sessionId).first();
      const docHash = row ? JSON.parse(row.facts).idHash : null;
      if (docHash && docHash !== h) review.findings.push({ code: 'submitted_spouse_id_differs_from_document', severity: 'high', detail: "The spouse ID number submitted differs from the ID number on the spouse's ID document", category: 'spouse_id' });
    }
    review.risk = overallRisk(review.findings);
    await env.DB.prepare('INSERT INTO document_checks (session_id, category, risk, findings, facts) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, 'submission', review.risk, JSON.stringify(review.findings), JSON.stringify({ salesRef })).run();
    if (review.risk === 'medium' || review.risk === 'high') {
      console.warn(JSON.stringify({ level: 'warn', type: 'document_review_flag', risk: review.risk, salesRef, codes: review.findings.map((f) => f.code) }));
    }
    return review;
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', type: 'document_review_failed', error: err.message }));
    return null;
  }
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** GET /api/documents/review?session=<id>   (header X-Tracking-Key) — for the finance team only. */
export async function handleDocumentReview(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  if (!env.TRACKING_API_KEY) return jsonResponse({ error: 'Not configured' }, 503, origin, env);
  if (!safeEqual(request.headers.get('X-Tracking-Key'), env.TRACKING_API_KEY)) return jsonResponse({ error: 'Unauthorized' }, 401, origin, env);
  const session = new URL(request.url).searchParams.get('session') || '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(session)) return jsonResponse({ error: 'Invalid session' }, 400, origin, env);
  return jsonResponse({ ok: true, session, ...(await reviewSession(env, session)) }, 200, origin, env);
}
