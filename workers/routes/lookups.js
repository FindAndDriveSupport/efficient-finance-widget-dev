export async function handleLookups(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const type = url.pathname.split('/').pop();
  const query = (url.searchParams.get('q') || '').trim();
  const makeFilter = (url.searchParams.get('make') || '').trim();

  const tableMap = {
    occupations: 'occupations',
    industries:  'industry_types',
    banks:       'banks',
    'vehicle-makes': 'vehicle_makes',
    'vehicle-models': 'vehicle_models',
  };
  const table = tableMap[type];
  if (!table) return jsonResponse({ error: 'Invalid lookup type' }, 400, origin, env);

  // Banks returns extra fields (branch_code)
  const isBanks = type === 'banks';
  const isVehicleModels = type === 'vehicle-models';
  const selectCols = isBanks ? 'id, name, branch_code' : 'id, name';

  try {
    let results;

    if (isVehicleModels) {
      // vehicle-models requires a make filter — join to vehicle_makes by name
      if (!makeFilter) {
        return jsonResponse({ error: 'Missing required "make" query parameter' }, 400, origin, env);
      }
      const { results: rows } = await env.DB.prepare(
        `SELECT vm.id, vm.name
         FROM vehicle_models vm
         JOIN vehicle_makes ma ON ma.id = vm.make_id
         WHERE ma.name = ?1
         ${query.length >= 1 ? 'AND vm.name LIKE ?2' : ''}
         ORDER BY vm.name ASC
         LIMIT 1000`
      ).bind(...(query.length >= 1 ? [makeFilter, `%${query}%`] : [makeFilter])).all();
      results = rows;
    } else if (query.length < 1) {
      const { results: rows } = await env.DB.prepare(
        `SELECT ${selectCols} FROM ${table} ORDER BY name ASC LIMIT 1000`
      ).all();
      results = rows;
    } else {
      const { results: rows } = await env.DB.prepare(
        `SELECT ${selectCols} FROM ${table} WHERE name LIKE ?1 ORDER BY name ASC LIMIT 1000`
      ).bind(`%${query}%`).all();
      results = rows;
    }

    return jsonResponse({ results }, 200, origin, env);
  } catch (err) {
    console.error('Lookup error:', err.message, err.stack);
    return jsonResponse({ error: 'Lookup failed', details: err.message }, 500, origin, env);
  }
}
