/**
 * worker.js — E-fficient Finance Widget
 * Cloudflare Worker: API proxy, auth, CORS, dealer routing
 */

import { isOriginAllowed, getDealerConfig, getDealerByBranchCode } from './dealers/dealers.config.js';
import { handlePreQual }         from './routes/preQual.js';
import { handlePrediction }      from './routes/prediction.js';
import { handleGetApplicant }    from './routes/getApplicant.js';
import { handleCreatePolicy }    from './routes/createPolicy.js';
import { handleSubmitDocuments } from './routes/submitDocuments.js';
import { handleDealerConfig }    from './routes/dealerConfig.js';
import { handleAddressSearch }   from './routes/addressSearch.js';
import { handleGetPolicies }     from './routes/getPolicies.js';
import { handleLookups }         from './routes/lookups.js';
import { runStatusSync, runFullBackfill, runPerDealerBackfill, debugFetchStatusListXML, debugFetchPolicyDetailsXML } from './routes/statusSync.js';

// ── CORS headers ──────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = !origin || isOriginAllowed(origin) || env.WORKER_ENV === 'development';
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dealer-Key, X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, origin = '*', env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
    },
  });
}

// ── Main fetch handler ────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') ||
      (() => {
        const ref = request.headers.get('Referer');
        if (!ref) return '';
        try { return new URL(ref).origin; } catch { return ''; }
      })();
    const method = request.method;

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // Block non-whitelisted origins (except in dev or when no origin header)
    if (origin && env.WORKER_ENV !== 'development' && !isOriginAllowed(origin)) {
      return jsonResponse({ error: 'Origin not permitted' }, 403, origin, env);
    }

    // Dealer context — from header or query param
    const dealerKey    = request.headers.get('X-Dealer-Key') || url.searchParams.get('dealer');
    const dealerConfig = getDealerConfig(dealerKey, origin);

    // Allow branch code override via query param — for multi-branch dealer
    // groups (e.g. Alpine Motors, where each branch has its own dealerConfig
    // entry and its own Seriti dealershipID). branchCode and dealershipID
    // must always travel together: if the override resolves to a known
    // dealer entry, sync both fields from that entry so the pair sent to
    // Seriti is never mismatched. If the override doesn't match any known
    // branch, keep the raw branchCode override but drop dealershipID rather
    // than risk sending a stale ID for the wrong branch.
    const branchOverride = url.searchParams.get('branchCode');
    if (branchOverride && /^[A-Z0-9]{4,12}$/.test(branchOverride)) {
      const overrideDealer = getDealerByBranchCode(branchOverride);
      if (overrideDealer) {
        dealerConfig.branchCode  = overrideDealer.branchCode;
        dealerConfig.dealershipID = overrideDealer.dealershipID;
      } else {
        dealerConfig.branchCode  = branchOverride;
        dealerConfig.dealershipID = undefined;
      }
    }

    // Inject env + dealerConfig into a context object
    const ctx2 = { env, dealerConfig, origin, ctx };

    try {
      const path = url.pathname;

      if (path === '/api/dealer/config' && method === 'GET') {
        return handleDealerConfig(request, ctx2, jsonResponse);
      }
      if (path === '/api/financing/pre-qualification' && method === 'POST') {
        return handlePreQual(request, ctx2, jsonResponse);
      }
      if (path === '/api/financing/prediction' && method === 'POST') {
        return handlePrediction(request, ctx2, jsonResponse);
      }
      if (path === '/api/address-search' && method === 'GET') {
        return handleAddressSearch(request, ctx2, jsonResponse);
      }
      if (path.startsWith('/api/lookup/') && method === 'GET') {
        return handleLookups(request, ctx2, jsonResponse);
      }
      if (path === '/api/financing/applicant' && method === 'GET') {
        return handleGetApplicant(request, ctx2, jsonResponse);
      }
      if (path === '/api/policy/create' && method === 'POST') {
        return handleCreatePolicy(request, ctx2, jsonResponse);
      }
      if (path === '/api/policy/documents' && method === 'POST') {
        return handleSubmitDocuments(request, ctx2, jsonResponse);
      }
      if (path === '/api/policies' && method === 'GET') {
        return handleGetPolicies(request, ctx2, jsonResponse);
      }

      // ── TEMPORARY DEBUG ROUTE — remove after testing statusSync ──
      if (path === '/api/debug/run-status-sync' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const result = await runStatusSync(env);
        return jsonResponse(result, 200, origin, env);
      }

      // ── TEMPORARY DEBUG ROUTE — view raw Edith XML directly in browser ──
      // ?branchCode=... optional (defaults to ALL). ?since=dd-mmm-yyyy HH:nn optional.
      if (path === '/api/debug/raw-status-list' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const branchCodeParam = url.searchParams.get('branchCode') || 'ALL';
        const sinceParam = url.searchParams.get('since') || null;
        try {
          const { requestXml, responseXml, startDate, branchCode } = await debugFetchStatusListXML(env, branchCodeParam, sinceParam);
          const text = `branchCode used: ${branchCode}\nstartDate used: ${startDate}\n\n--- REQUEST XML ---\n${requestXml}\n\n--- RESPONSE XML ---\n${responseXml}`;
          return new Response(text, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin, env) },
          });
        } catch (err) {
          return new Response(`Error calling Edith: ${err.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin, env) },
          });
        }
      }

      // ── TEMPORARY DEBUG ROUTE — view raw GetPolicyDetails XML in browser ──
      if (path === '/api/debug/raw-policy-details' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const policyNumber = url.searchParams.get('policyNumber');
        if (!policyNumber) {
          return new Response('Missing ?policyNumber=... param', { status: 400 });
        }
        try {
          const { requestXml, responseXml } = await debugFetchPolicyDetailsXML(env, policyNumber);
          const text = `--- REQUEST XML ---\n${requestXml}\n\n--- RESPONSE XML ---\n${responseXml}`;
          return new Response(text, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin, env) },
          });
        } catch (err) {
          return new Response(`Error calling Edith: ${err.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin, env) },
          });
        }
      }

      // ── TEMPORARY DEBUG ROUTE — trigger one-time historical backfill ──
      // Whole-account (branchCode: 'ALL') backfill — same as before.
      if (path === '/api/debug/backfill-status' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const sinceDate = url.searchParams.get('since');
        const result = sinceDate ? await runFullBackfill(env, sinceDate) : await runFullBackfill(env);
        return jsonResponse(result, 200, origin, env);
      }

      // ── TEMPORARY DEBUG ROUTE — per-dealer-scoped backfill ──
      // Loops through every dealer in D1 with a known branch_code, calling
      // GetPolicyStatusList individually for EACH one — rather than one
      // branchCode: 'ALL' account-wide call. Lets the ID/mobile number
      // promotion matching run with per-dealer visibility into results.
      // Usage: /api/debug/backfill-per-dealer?key=...&since=10-jun-2026 00:00&offset=0&limit=8
      // Runs in the BACKGROUND via ctx.waitUntil() — returns immediately
      // rather than waiting synchronously for dealers to finish. Even
      // background execution has its own time limit though (confirmed via
      // a real "waitUntil() tasks did not complete... cancelled" warning
      // processing all 36 dealers in one call) — use offset/limit to run
      // in smaller batches instead, e.g. limit=8 run five times with
      // offset=0,8,16,24,32. Each response includes nextOffset (in the
      // eventual summary log) to chain the next call.
      if (path === '/api/debug/backfill-per-dealer' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const sinceDate = url.searchParams.get('since') || undefined;
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : null;

        ctx.waitUntil(
          runPerDealerBackfill(env, sinceDate || '10-jun-2026 00:00', offset, limit)
            .catch(err => console.error('[backfill-per-dealer] background run failed:', err.message))
        );

        return jsonResponse({
          started: true,
          message: 'Per-dealer backfill running in the background — check the Cloudflare log stream for progress (search "per_dealer_backfill") and the final summary (search "per_dealer_backfill_done").',
          sinceDate: sinceDate || '(default)',
          offset, limit,
        }, 202, origin, env);
      }

      return jsonResponse({ error: 'Not found' }, 404, origin, env);

    } catch (err) {
      console.error('[Worker] Unhandled error:', err);
      return jsonResponse({ error: 'Internal server error', details: err.message }, 500, origin, env);
    }
  },

  // ── Scheduled handler (cron) ──────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runStatusSync(env));
  },
};
