/**
 * worker.js — E-fficient Finance Widget
 * Cloudflare Worker: API proxy, auth, CORS, dealer routing
 */

import { isOriginAllowed, getDealerConfig } from './dealers/dealers.config.js';
import { handlePreQual }         from './routes/preQual.js';
import { handlePrediction }      from './routes/prediction.js';
import { handleGetApplicant }    from './routes/getApplicant.js';
import { handleCreatePolicy }    from './routes/createPolicy.js';
import { handleSubmitDocuments } from './routes/submitDocuments.js';
import { handleDealerConfig }    from './routes/dealerConfig.js';
import { handleAddressSearch }   from './routes/addressSearch.js';
import { handleGetPolicies }     from './routes/getPolicies.js';
import { handleLookups }         from './routes/lookups.js';
import { runStatusSync, runFullBackfill, debugFetchStatusListXML, debugFetchPolicyDetailsXML } from './routes/statusSync.js';

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

    // Allow branch code override via query param — for multi-branch dealer groups
    const branchOverride = url.searchParams.get('branchCode');
    if (branchOverride && /^[A-Z0-9]{4,12}$/.test(branchOverride)) {
      dealerConfig.branchCode = branchOverride;
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
      // Manually triggers the daily Edith status sync over HTTP, since
      // Cloudflare's dashboard has no "run cron now" button. Gated behind
      // a secret query param so it can't be triggered by randoms hitting
      // the URL. Set DEBUG_SYNC_KEY via `wrangler secret put DEBUG_SYNC_KEY`.
      if (path === '/api/debug/run-status-sync' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const result = await runStatusSync(env);
        return jsonResponse(result, 200, origin, env);
      }

      // ── TEMPORARY DEBUG ROUTE — view raw Edith XML directly in browser ──
      // Same key gate as above. Returns the raw SOAP request/response as
      // plain text so it can be read on mobile with no terminal/log access.
      if (path === '/api/debug/raw-status-list' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        try {
          const { requestXml, responseXml, startDate } = await debugFetchStatusListXML(env);
          const text = `startDate used: ${startDate}\n\n--- REQUEST XML ---\n${requestXml}\n\n--- RESPONSE XML ---\n${responseXml}`;
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
      // Usage: /api/debug/raw-policy-details?key=...&policyNumber=ZAYOND0013130665
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
      // Catches up policies whose last Edith edit predates this sync system,
      // which the daily incremental sync will never see (it only looks
      // "since last run"). Safe to re-run — existing rows just get updated.
      // Optional ?since=dd-mmm-yyyy HH:nn to override the default 2020 start.
      if (path === '/api/debug/backfill-status' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!env.DEBUG_SYNC_KEY || key !== env.DEBUG_SYNC_KEY) {
          return jsonResponse({ error: 'Not found' }, 404, origin, env);
        }
        const sinceDate = url.searchParams.get('since');
        const result = sinceDate ? await runFullBackfill(env, sinceDate) : await runFullBackfill(env);
        return jsonResponse(result, 200, origin, env);
      }

      return jsonResponse({ error: 'Not found' }, 404, origin, env);

    } catch (err) {
      console.error('[Worker] Unhandled error:', err);
      return jsonResponse({ error: 'Internal server error', details: err.message }, 500, origin, env);
    }
  },

  // ── Scheduled handler (cron) ──────────────────────────────────
  // Daily sync of policy application/finance/transaction status from Edith
  // into policy_events. See routes/statusSync.js for implementation.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runStatusSync(env));
  },
};