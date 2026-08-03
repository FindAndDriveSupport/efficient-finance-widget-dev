/**
 * seritiAuth.js
 * Manages Seriti API bearer token with automatic refresh (token expires hourly).
 * Uses Cloudflare KV for token caching across Worker instances.
 */

const SERITI_BASE = 'https://seritiapi.findndrive.co.za';
const TOKEN_BUFFER_SECONDS = 120;

function tokenCacheKey(dealerKey) {
  return dealerKey ? `seriti_token_${dealerKey}` : 'seriti_bearer_token';
}

async function getDealerCredentials(env, dealerKey) {
  if (!dealerKey || !env.SERITI_CACHE) {
    return { apiKey: env.SERITI_API_KEY, apiSecret: env.SERITI_API_SECRET };
  }
  const [apiKey, apiSecret] = await Promise.all([
    env.SERITI_CACHE.get(`SERITI_KEY_${dealerKey}`),
    env.SERITI_CACHE.get(`SERITI_SECRET_${dealerKey}`),
  ]);
  return {
    apiKey: apiKey || env.SERITI_API_KEY,
    apiSecret: apiSecret || env.SERITI_API_SECRET,
  };
}

export async function getSeritiToken(env, dealerKey) {
  const cacheKey = tokenCacheKey(dealerKey);

  // Try cache first
  if (env.SERITI_CACHE) {
    const cached = await env.SERITI_CACHE.get(cacheKey, 'json');
    if (cached && cached.token && cached.expiresAt > Date.now()) {
      return cached.token;
    }
  }

  // Get dealer-specific or global credentials
  const { apiKey, apiSecret } = await getDealerCredentials(env, dealerKey);

  if (!apiKey || !apiSecret) {
    // Previously threw with no logging at all — if this fired, the only
    // trace was whatever caught it further up the call chain (now
    // preQual.js's catch block logs err.message, but nothing logged HERE,
    // at the actual point of failure). Logging directly at each throw
    // point makes future alerts unambiguous about exactly which of the
    // three failure modes in this function occurred, rather than relying
    // on the error message string surviving intact through every caller.
    console.error(JSON.stringify({
      level: 'error',
      type: 'seriti_auth_missing_credentials',
      dealerKey: dealerKey || 'global',
      ts: new Date().toISOString(),
    }));
    throw new Error(`Seriti credentials not found for dealer: ${dealerKey || 'global'}`);
  }

  // Fetch new token
  const response = await fetch(`${SERITI_BASE}/api/Authentication/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ApiKeyId: apiKey, apiSecret }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(JSON.stringify({
      level: 'error',
      type: 'seriti_auth_failed',
      dealerKey: dealerKey || 'global',
      status: response.status,
      body: text.substring(0, 2000),
      ts: new Date().toISOString(),
    }));
    throw new Error(`Seriti auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const token = data.token || data.access_token || data.accessToken;
  if (!token) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'seriti_auth_no_token_in_response',
      dealerKey: dealerKey || 'global',
      body: JSON.stringify(data).substring(0, 2000),
      ts: new Date().toISOString(),
    }));
    throw new Error('Seriti auth: no token in response');
  }

  // Cache for 58 minutes
  if (env.SERITI_CACHE) {
    const expiresAt = Date.now() + (58 * 60 * 1000);
    await env.SERITI_CACHE.put(cacheKey, JSON.stringify({ token, expiresAt }), {
      expirationTtl: 3480,
    });
  }

  return token;
}

export async function seritiRequest(path, options = {}, env, dealerKey) {
  const token = await getSeritiToken(env, dealerKey);
  const url = `${SERITI_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  // Log full Seriti response for diagnostics
  console.log(JSON.stringify({
    level: 'info',
    type: 'seriti_response',
    path,
    dealerKey,
    status: response.status,
    body: text.substring(0, 2000),
    ts: new Date().toISOString(),
  }));

  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const err = new Error(`Seriti API error (${response.status}): ${JSON.stringify(data)}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
}
