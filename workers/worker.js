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

      return jsonResponse({ error: 'Not found' }, 404, origin, env);

    } catch (err) {
      console.error('[Worker] Unhandled error:', err);
      return jsonResponse({ error: 'Internal server error', details: err.message }, 500, origin, env);
    }
  },
};