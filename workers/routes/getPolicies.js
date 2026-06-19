
/**
 * getPolicies.js — GET /api/policies
 *
 * Returns policy events for a dealer, filtered by date range.
 * Authenticated using the dealer's Seriti API key (stored in KV).
 *
 * Query params:
 *   dealerKey  — required, e.g. yonda-bike
 *   since      — optional ISO datetime, e.g. 2026-06-18T00:00:00Z
 *   until      — optional ISO datetime, defaults to now
 *   limit      — optional, max 100, default 50
 */

export async function handleGetPolicies(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);

  const dealerKey = url.searchParams.get('dealerKey');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  if (!dealerKey) {
    return jsonResponse({ error: 'Missing required param: dealerKey' }, 400, origin, env);
  }

  // Authenticate using dealer's Seriti API key from KV
  const apiKey = request.headers.get('X-Api-Key');
  if (!apiKey) {
    return jsonResponse({ error: 'Missing X-Api-Key header' }, 401, origin, env);
  }

  const storedKey = await env.SERITI_CACHE.get(`SERITI_KEY_${dealerKey}`);
  if (!storedKey || storedKey !== apiKey) {
    return jsonResponse({ error: 'Invalid API key' }, 403, origin, env);
  }

  // Build query
  let query = `
    SELECT id, dealer_key, policy_number, applicant_id, sales_ref, branch_code, finance_type, created_at
    FROM policy_events
    WHERE dealer_key = ?
  `;
  const params = [dealerKey];

  if (since) {
    query += ` AND created_at >= ?`;
    params.push(since);
  }
  if (until) {
    query += ` AND created_at <= ?`;
    params.push(until);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  try {
    const result = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse({
      dealer_key: dealerKey,
      count: result.results.length,
      policies: result.results,
    }, 200, origin, env);
  } catch (err) {
    console.error('getPolicies DB error:', err.message);
    return jsonResponse({ error: 'Failed to fetch policies' }, 500, origin, env);
  }
}
