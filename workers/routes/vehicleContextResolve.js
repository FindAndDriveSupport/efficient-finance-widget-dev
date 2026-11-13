/**
 * POST /api/v1/vehicle-context/resolve
 *
 * Called by the E-fficient widget for BOTH:
 *  - normalizing a raw JSON-LD "name" string into {year, make, model}
 *  - the final resolve step once the widget already has {year, make, model}
 *
 * Treats everything from the page as untrusted input (spec §10) — validated
 * and, where possible, matched against the Find&Drive vehicle reference
 * table (vehicle_stock) so we return a canonical make/model rather than
 * trusting the page.
 *
 * Expects env.DB bound to the D1 database holding vehicle_stock.
 *
 * Follows the same handler signature as the other routes/*.js files:
 * handleX(request, ctx2, jsonResponse), where ctx2 = { env, dealerConfig, origin, ctx }
 * and jsonResponse is the shared (data, status, origin, env) => Response helper
 * from worker.js. CORS is already handled globally there, so nothing extra
 * is needed here for that.
 */

const MULTI_WORD_MAKES = ['Mercedes-Benz', 'Land Rover', 'Alfa Romeo', 'Great Wall', 'Aston Martin'];

// SSRF guard: only ever fetch pages on domains we actually expect vehicle
// context requests to reference. Extend this list as more dealer sites are
// added — never fetch an arbitrary caller-supplied hostname.
const ALLOWED_PAGE_HOSTS = ['carfo.co.za', 'www.carfo.co.za'];

const VEHICLE_JSONLD_TYPES = ['Vehicle', 'Car', 'Product', 'AutoDealer', 'Offer'];

export async function handleVehicleContextResolve(request, ctx2, jsonResponse) {
  const { env, origin } = ctx2;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ resolved: false, error: 'invalid_json' }, 400, origin, env);
  }

  const year = sanitizeYear(body.year);

  // Case 1: widget already has separated make/model (from structured JSON-LD fields).
  if (body.make && body.model && year) {
    const resolved = await resolveCanonical(env.DB, year, sanitizeText(body.make), sanitizeText(body.model));
    return jsonResponse(resolved, 200, origin, env);
  }

  // Case 2: widget only has a combined free-text name — parse it here, server-side.
  if (body.name) {
    const parsed = parseVehicleName(sanitizeText(body.name), year);
    if (!parsed) {
      return jsonResponse({ resolved: false }, 200, origin, env);
    }
    const resolved = await resolveCanonical(env.DB, parsed.year, parsed.make, parsed.model);
    return jsonResponse(resolved, 200, origin, env);
  }

  // Case 3: widget only has the host page's URL (from document.referrer, since
  // it can't read the parent page's DOM directly inside a cross-origin iframe).
  // Fetch that ONE page server-side and read its JSON-LD — same data the page
  // already publishes for search engines, just read from the server instead
  // of the browser. Never fetches anything outside ALLOWED_PAGE_HOSTS.
  if (body.pageUrl) {
    const extracted = await extractVehicleFromPage(body.pageUrl);
    if (!extracted) {
      return jsonResponse({ resolved: false }, 200, origin, env);
    }
    if (extracted.make && extracted.model && extracted.year) {
      const resolved = await resolveCanonical(env.DB, extracted.year, extracted.make, extracted.model);
      return jsonResponse(resolved, 200, origin, env);
    }
    if (extracted.name) {
      const parsed = parseVehicleName(extracted.name, extracted.year);
      if (parsed) {
        const resolved = await resolveCanonical(env.DB, parsed.year, parsed.make, parsed.model);
        return jsonResponse(resolved, 200, origin, env);
      }
    }
    return jsonResponse({ resolved: false }, 200, origin, env);
  }

  return jsonResponse({ resolved: false }, 400, origin, env);
}

/**
 * Fetches a single dealer page and reads its JSON-LD, looking for a vehicle-
 * shaped node. Returns { name?, year?, make?, model? } or null — never throws;
 * any failure (disallowed host, network error, no JSON-LD, malformed JSON)
 * just means "nothing found," same as any other unresolved case.
 */
async function extractVehicleFromPage(pageUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_PAGE_HOSTS.includes(parsedUrl.hostname)) {
    return null;
  }

  let res;
  try {
    res = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'FindAndDriveVehicleContextBot/1.0 (+vehicle finance widget)' },
      cf: { cacheTtl: 300, cacheEverything: true }, // avoid re-fetching the same page repeatedly (spec §10)
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const jsonLdChunks = [];
  let buffer = '';
  const rewriter = new HTMLRewriter().on('script[type="application/ld+json"]', {
    text(chunk) {
      buffer += chunk.text;
      if (chunk.lastInTextNode) {
        jsonLdChunks.push(buffer);
        buffer = '';
      }
    },
  });

  try {
    await rewriter.transform(res).text(); // drains the stream so the handlers above actually run
  } catch {
    return null;
  }

  const nodes = [];
  for (const chunk of jsonLdChunks) {
    let parsed;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue; // malformed JSON-LD block — skip it, don't fail the whole page
    }
    flattenJsonLd(parsed, nodes);
  }

  const vehicleNode = nodes.find((node) => {
    const t = node['@type'];
    const types = Array.isArray(t) ? t : (typeof t === 'string' ? [t] : []);
    return types.some((type) => VEHICLE_JSONLD_TYPES.includes(type));
  });
  if (!vehicleNode) return null;

  const brand = vehicleNode.brand && (typeof vehicleNode.brand === 'object' ? vehicleNode.brand.name : vehicleNode.brand);
  const model = typeof vehicleNode.model === 'string' ? vehicleNode.model : vehicleNode.model?.name;
  const rawYear = vehicleNode.vehicleModelDate || vehicleNode.modelDate || vehicleNode.productionDate || vehicleNode.releaseDate;

  return {
    name: typeof vehicleNode.name === 'string' ? vehicleNode.name : undefined,
    year: sanitizeYear(rawYear),
    make: typeof brand === 'string' ? sanitizeText(brand) : undefined,
    model: typeof model === 'string' ? sanitizeText(model) : undefined,
  };
}

function flattenJsonLd(value, out) {
  if (Array.isArray(value)) {
    value.forEach((v) => flattenJsonLd(v, out));
    return;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value['@graph'])) {
      flattenJsonLd(value['@graph'], out);
      return;
    }
    out.push(value);
  }
}

/**
 * Three-tier canonicalization against the vehicle reference table:
 *  1. Exact match — same year, same make, same model.
 *  2. Fuzzy match — same make, model matched on its leading word (e.g. "Puma",
 *     "T-Roc", "Tiggo"), nearest year within stock if the exact year isn't there.
 *     Handles trim/variant text riding along in the page's model string.
 *  3. No match — page-derived value is still returned (the widget needs
 *     *something* to pre-populate with), but flagged canonical:false so the
 *     finance flow / analytics can tell it wasn't verified against our data.
 *     No mmcode is available in this case — Edith submission must not send
 *     a stale/guessed one, so it comes back undefined.
 *
 * Returns: { resolved, canonical, matchType: 'exact'|'fuzzy'|'none', year, make, model, mmcode? }
 */
async function resolveCanonical(db, year, make, model) {
  const exact = await db
    .prepare(
      `SELECT DISTINCT year, make, model, mmcode FROM vehicle_stock
       WHERE year = ?1 AND make = ?2 COLLATE NOCASE AND model = ?3 COLLATE NOCASE
       LIMIT 1`
    )
    .bind(year, make, model)
    .first();

  if (exact) {
    return { resolved: true, canonical: true, matchType: 'exact', ...exact };
  }

  const leadWord = leadingModelWord(model);
  if (leadWord) {
    const fuzzy = await db
      .prepare(
        `SELECT DISTINCT year, make, model, mmcode FROM vehicle_stock
         WHERE make = ?1 COLLATE NOCASE AND model LIKE ?2 COLLATE NOCASE
         ORDER BY ABS(year - ?3) ASC
         LIMIT 1`
      )
      .bind(make, `${leadWord}%`, year)
      .first();

    if (fuzzy) {
      return { resolved: true, canonical: true, matchType: 'fuzzy', ...fuzzy };
    }
  }

  // Nothing in the reference table — pass the page-derived value through unmatched.
  // mmcode intentionally omitted: we have no verified code to give it.
  return { resolved: true, canonical: false, matchType: 'none', year, make, model };
}

/** First significant token of a model string, used as the fuzzy-match anchor (e.g. "Puma" from "Puma 1.0t Ecoboost St-line"). */
function leadingModelWord(model) {
  const word = model.trim().split(/\s+/)[0];
  return word && word.length >= 2 ? word : null;
}

/**
 * GET /api/vehicle-context/mmcode?make=...&model=...
 *
 * Used by the manual vehicle-selection flow (VehicleSelection / Step3 dropdowns),
 * which pick make/model from /api/lookup/vehicle-makes and vehicle-models — a
 * separate lookup table from vehicle_stock, so mmcode isn't known until this
 * is called explicitly once the customer has picked both fields.
 *
 * No year is collected in the manual flow, so this matches on make+model alone
 * and, if more than one year is in stock for that combo, prefers the most
 * recent one. Returns { resolved: false } if there's no match — the frontend
 * should leave vehicleMm unset in that case rather than sending a guess to Edith.
 */
export async function handleVehicleMmcodeLookup(request, ctx2, jsonResponse) {
  const { env, origin } = ctx2;
  const url = new URL(request.url);
  const make = sanitizeText(url.searchParams.get('make') || '');
  const model = sanitizeText(url.searchParams.get('model') || '');

  if (!make || !model) {
    return jsonResponse({ resolved: false, error: 'missing_make_or_model' }, 400, origin, env);
  }

  const row = await env.DB
    .prepare(
      `SELECT mmcode, year FROM vehicle_stock
       WHERE make = ?1 COLLATE NOCASE AND model = ?2 COLLATE NOCASE
       ORDER BY year DESC
       LIMIT 1`
    )
    .bind(make, model)
    .first();

  if (!row) {
    return jsonResponse({ resolved: false }, 200, origin, env);
  }

  return jsonResponse({ resolved: true, mmcode: row.mmcode, year: row.year }, 200, origin, env);
}

/** Mirrors the JSON-LD parsing rule from spec §6: don't naively split on spaces. */
function parseVehicleName(rawName, yearHint) {
  let text = rawName.trim();

  // Strip a leading duplicate year token, e.g. "2025 Volkswagen Polo Vivo ..."
  const leadingYearMatch = text.match(/^(\d{4})\s+/);
  const year = yearHint ?? (leadingYearMatch ? Number(leadingYearMatch[1]) : undefined);
  if (leadingYearMatch) text = text.slice(leadingYearMatch[0].length);

  if (!year) return null; // spec requires year; refuse to guess one

  const upper = text.toUpperCase();
  let make = null;
  let rest = text;

  for (const mw of MULTI_WORD_MAKES) {
    if (upper.startsWith(mw.toUpperCase())) {
      make = mw;
      rest = text.slice(mw.length).trim();
      break;
    }
  }

  if (!make) {
    const words = text.split(/\s+/);
    if (words.length === 0 || !words[0]) return null;
    make = titleCase(words[0]);
    rest = words.slice(1).join(' ');
  }

  // Model is the next token(s) up to where trim/engine spec typically starts
  // (a digit, displacement unit, or known trim-starting pattern). This is a
  // conservative heuristic — the D1 lookup above is what actually canonicalizes it.
  const model = rest.split(/\s+(?=\d)/)[0].trim() || rest.trim();

  if (!make || !model) return null;
  return { year, make, model: titleCase(model) };
}

function sanitizeYear(year) {
  const n = typeof year === 'number' ? year : Number(year);
  if (!Number.isInteger(n) || n < 1980 || n > 2100) return undefined;
  return n;
}

function sanitizeText(s) {
  // Strip anything that isn't plausible vehicle-name text; defence against
  // script-like or otherwise unexpected content smuggled in via JSON-LD.
  return s.replace(/[<>{}$`]/g, '').trim().slice(0, 200);
}

function titleCase(s) {
  return s === s.toUpperCase() ? s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : s;
}
