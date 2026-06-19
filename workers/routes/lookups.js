export async function handleLookups(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const type = url.pathname.split('/').pop();
  const query = (url.searchParams.get('q') || '').trim();

  const tableMap = {
    occupations: 'occupations',
    industries:  'industry_types',
    banks:       'banks',
  };

  const table = tableMap[type];
  if (!table) return jsonResponse({ error: 'Invalid lookup type' }, 400, origin, env);

  // Banks returns extra fields (branch_code)
  const isBanks = type === 'banks';
  const selectCols = isBanks ? 'id, name, branch_code' : 'id, name';

  try {
    let results;
    if (query.length < 1) {
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
