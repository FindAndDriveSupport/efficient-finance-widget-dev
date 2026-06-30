/**
 * seritiAuth.js
 * Manages Seriti API bearer token with automatic refresh (token expires hourly).
 * Uses Cloudflare KV for token caching across Worker instances.
 *
 * Required KV namespace: SERITI_CACHE (bind in wrangler.toml)
 * Required secrets: SERITI_API_KEY, SERITI_API_SECRET
 */

const SERITI_BASE = 'https://seritiapi.findndrive.co.za';
const TOKEN_CACHE_KEY = 'seriti_bearer_token';
const TOKEN_BUFFER_SECONDS = 120; // refresh 2 min before expiry

/**
 * Get a valid Seriti bearer token.
 * Checks KV cache first; fetches a new one if missing or expired.
 */
export async function getSeritiToken(env) {
  // Try cache first
  if (env.SERITI_CACHE) {
    const cached = await env.SERITI_CACHE.get(TOKEN_CACHE_KEY, 'json');
    if (cached && cached.token && cached.expiresAt > Date.now()) {
      return cached.token;
    }
  }

  // Fetch new token
  const response = await fetch(`${SERITI_BASE}/api/Auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: env.SERITI_API_KEY,
      apiSecret: env.SERITI_API_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seriti auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const token = data.token || data.access_token || data.accessToken;

  if (!token) throw new Error('Seriti auth: no token in response');

  // Cache for 58 minutes (token is 60 min, buffer 2 min)
  if (env.SERITI_CACHE) {
    const expiresAt = Date.now() + (58 * 60 * 1000);
    await env.SERITI_CACHE.put(TOKEN_CACHE_KEY, JSON.stringify({ token, expiresAt }), {
      expirationTtl: 3480, // 58 min in seconds
    });
  }

  return token;
}

/**
 * Make an authenticated request to the Seriti API.
 */
export async function seritiRequest(path, options = {}, env) {
  const token = await getSeritiToken(env);

  const response = await fetch(`${SERITI_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    throw new Error(`Seriti API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}
