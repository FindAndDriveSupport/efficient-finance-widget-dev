/**
 * progress.js — step-by-step application progress tracking (standalone app)
 *
 *   POST /api/progress/track          called by the wizard on every step (public, fire-and-forget)
 *   GET  /api/progress/lookup?id=…    tracker page lookup by ID number (needs X-Tracking-Key)
 *
 * Events are stored in D1 `application_progress`. The ID / passport number is
 * never stored raw here — only an HMAC (env.PROGRESS_PEPPER), so lookups work
 * without the table holding ID numbers.
 *
 * Tracking must never affect the applicant: every function below swallows its
 * own errors and recordProgressEvent() never throws.
 */

const STEPS = new Set(['vehicle', 'applicant', 'employment', 'financial', 'documents', 'spouse', 'submitted']);
const EVENTS = new Set(['entered', 'submitted', 'failed', 'manual_followup']);
const MAX_EVENTS_PER_SESSION = 200;
const DROP_OFF_AFTER_MS = 30 * 60 * 1000; // no activity for 30 min and not submitted = dropped off
const MAX_SESSIONS_PER_LOOKUP = 20;

const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

/** HMAC-SHA256 (hex) of the normalised ID/passport number. Null if not usable. */
export async function hashIdNumber(env, idNumber) {
  if (!env?.PROGRESS_PEPPER || idNumber == null) return null;
  const norm = String(idNumber).replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{5,30}$/.test(norm)) return null;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.PROGRESS_PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(norm));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Writes one progress event. Returns true if stored, false if rejected/failed.
 * evt: { sessionId, dealerKey, stepIndex, step, event, idNumber, name, mobile,
 *        vehicle, policyNumber, salesRef, detail }
 */
export async function recordProgressEvent(env, evt) {
  try {
    if (!env?.DB || !evt) return false;
    const sessionId = String(evt.sessionId || '');
    const step = String(evt.step || '');
    const event = String(evt.event || 'entered');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(sessionId) || !STEPS.has(step) || !EVENTS.has(event)) return false;

    const count = await env.DB
      .prepare('SELECT COUNT(*) AS n FROM application_progress WHERE session_id = ?')
      .bind(sessionId).first();
    if ((count?.n || 0) >= MAX_EVENTS_PER_SESSION) return false;

    const mobile = evt.mobile ? String(evt.mobile).replace(/\D/g, '').slice(0, 15) || null : null;
    const stepIndex = Number.isInteger(evt.stepIndex) && evt.stepIndex >= 0 && evt.stepIndex <= 10 ? evt.stepIndex : null;

    await env.DB.prepare(`
      INSERT INTO application_progress (
        session_id, dealer_key, step_index, step, event, id_number_hash,
        applicant_name, mobile, vehicle, policy_number, sales_ref, detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      clip(evt.dealerKey, 50),
      stepIndex,
      step,
      event,
      await hashIdNumber(env, evt.idNumber),
      clip(evt.name, 100),
      mobile,
      clip(evt.vehicle, 100),
      clip(evt.policyNumber, 50),
      clip(evt.salesRef, 60),
      clip(evt.detail, 300),
    ).run();
    return true;
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', type: 'progress_write_failed', error: err.message, ts: new Date().toISOString() }));
    return false;
  }
}

// ── POST /api/progress/track ──────────────────────────────────

export async function handleTrackProgress(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false }, 400, origin, env); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ ok: false }, 400, origin, env);

  // The router always resolves a dealerConfig (falling back to 'default'), so prefer the
  // dealer the app sent when the resolved one is only the default.
  const resolvedDealer = dealerConfig?.key && dealerConfig.key !== 'default' ? dealerConfig.key : null;

  const ok = await recordProgressEvent(env, {
    sessionId: body.sessionId,
    dealerKey: resolvedDealer || body.dealer,
    stepIndex: body.stepIndex,
    step: body.step,
    event: body.event || 'entered',
    idNumber: body.idNumber,
    name: body.name,
    mobile: body.mobile,
    vehicle: body.vehicle,
  });
  return jsonResponse({ ok }, ok ? 200 : 400, origin, env);
}

// ── GET /api/progress/lookup?id=… ─────────────────────────────

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function summariseSession(sessionId, rows, now = Date.now()) {
  const last = rows[rows.length - 1];
  const latest = (k) => [...rows].reverse().find((r) => r[k])?.[k] ?? null;
  const lastEntered = [...rows].reverse().find((r) => r.event === 'entered');
  const done = rows.some((r) => r.event === 'submitted' || r.event === 'manual_followup');
  const idle = now - Date.parse(last.created_at) > DROP_OFF_AFTER_MS;

  let status;
  if (done) status = 'submitted';
  else if (last.event === 'failed') status = idle ? 'dropped_off' : 'submit_failed';
  else status = idle ? 'dropped_off' : 'in_progress';

  return {
    sessionId,
    status,
    droppedAtStep: status === 'dropped_off' || status === 'submit_failed' ? (lastEntered?.step ?? last.step) : null,
    applicantName: latest('applicant_name'),
    mobile: latest('mobile'),
    vehicle: latest('vehicle'),
    dealer: latest('dealer_key'),
    policyNumber: latest('policy_number'),
    salesRef: latest('sales_ref'),
    startedAt: rows[0].created_at,
    lastActivityAt: last.created_at,
    timeline: rows.map((r) => ({
      step: r.step, event: r.event, at: r.created_at, ...(r.detail ? { detail: r.detail } : {}),
    })),
  };
}

export async function handleProgressLookup(request, ctx, jsonResponse) {
  const { env, origin } = ctx;

  if (!env.TRACKING_API_KEY) return jsonResponse({ error: 'Tracking lookup is not configured' }, 503, origin, env);
  if (!safeEqual(request.headers.get('X-Tracking-Key'), env.TRACKING_API_KEY)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin, env);
  }

  const id = new URL(request.url).searchParams.get('id');
  const hash = await hashIdNumber(env, id);
  if (!hash) return jsonResponse({ error: 'Enter a valid ID or passport number' }, 400, origin, env);

  try {
    const sessions = await env.DB.prepare(
      `SELECT session_id, MAX(id) AS last_id FROM application_progress
       WHERE id_number_hash = ? GROUP BY session_id ORDER BY last_id DESC LIMIT ?`,
    ).bind(hash, MAX_SESSIONS_PER_LOOKUP).all();

    const out = [];
    for (const s of sessions.results || []) {
      const rows = await env.DB.prepare(
        'SELECT * FROM application_progress WHERE session_id = ? ORDER BY id ASC LIMIT ?',
      ).bind(s.session_id, MAX_EVENTS_PER_SESSION).all();
      if (rows.results?.length) out.push(summariseSession(s.session_id, rows.results));
    }
    return jsonResponse({ found: out.length > 0, applications: out }, 200, origin, env);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', type: 'progress_lookup_failed', error: err.message, ts: new Date().toISOString() }));
    return jsonResponse({ error: 'Lookup failed' }, 500, origin, env);
  }
}
