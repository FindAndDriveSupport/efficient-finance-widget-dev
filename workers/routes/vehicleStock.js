/**
 * routes/vehicleStock.js
 * Vehicle make/model dropdown lookups sourced from carfo's live inventory
 * (vehicle_stock table — vehicle_no, reg_no, year, make, model, mmcode).
 * No dealer/branch column on this table — it holds only carfo's stock, so
 * no WHERE-clause scoping is needed.
 *
 * mmcode resolution for a chosen make+model still goes through the existing
 * /api/vehicle-context/mmcode route (handleVehicleMmcodeLookup in
 * vehicleContextResolve.js) — that already queries this same table
 * correctly; nothing here duplicates it.
 */

export async function handleVehicleStockMakes(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();

  try {
    let results;
    if (query.length < 1) {
      const { results: rows } = await env.DB.prepare(
        `SELECT DISTINCT make AS name FROM vehicle_stock ORDER BY make ASC LIMIT 1000`
      ).all();
      results = rows;
    } else {
      const { results: rows } = await env.DB.prepare(
        `SELECT DISTINCT make AS name FROM vehicle_stock WHERE make LIKE ?1 ORDER BY make ASC LIMIT 1000`
      ).bind(`%${query}%`).all();
      results = rows;
    }
    return jsonResponse({ results }, 200, origin, env);
  } catch (err) {
    console.error('Vehicle stock makes lookup error:', err.message, err.stack);
    return jsonResponse({ error: 'Lookup failed', details: err.message }, 500, origin, env);
  }
}

export async function handleVehicleStockModels(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const makeFilter = (url.searchParams.get('make') || '').trim();

  if (!makeFilter) {
    return jsonResponse({ error: 'Missing required "make" query parameter' }, 400, origin, env);
  }

  try {
    let results;
    if (query.length < 1) {
      const { results: rows } = await env.DB.prepare(
        `SELECT DISTINCT model AS name FROM vehicle_stock WHERE make = ?1 ORDER BY model ASC LIMIT 1000`
      ).bind(makeFilter).all();
      results = rows;
    } else {
      const { results: rows } = await env.DB.prepare(
        `SELECT DISTINCT model AS name FROM vehicle_stock WHERE make = ?1 AND model LIKE ?2 ORDER BY model ASC LIMIT 1000`
      ).bind(makeFilter, `%${query}%`).all();
      results = rows;
    }
    return jsonResponse({ results }, 200, origin, env);
  } catch (err) {
    console.error('Vehicle stock models lookup error:', err.message, err.stack);
    return jsonResponse({ error: 'Lookup failed', details: err.message }, 500, origin, env);
  }
}