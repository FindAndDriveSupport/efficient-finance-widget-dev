/**
 * vehicleStockUnits.js — GET /api/lookup/vehicle-stock-units?make=&model=
 * Lists the individual stock units for a make + model so the applicant can pick the
 * exact vehicle (VIN, colour, mileage and price come from vehicle_stock in D1).
 */
export async function handleVehicleStockUnits(request, ctx, jsonResponse) {
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const make = (url.searchParams.get('make') || '').trim();
  const model = (url.searchParams.get('model') || '').trim();
  if (!make || !model || make.length > 60 || model.length > 80) {
    return jsonResponse({ error: 'make and model are required' }, 400, origin, env);
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT vehicle_no, year, make, model, mmcode, vin_number, colour, mileage, selling_price, department
       FROM vehicle_stock
       WHERE UPPER(make) = UPPER(?) AND UPPER(model) = UPPER(?)
       ORDER BY selling_price ASC, vehicle_no ASC
       LIMIT 60`,
    ).bind(make, model).all();
    const units = (results || []).map((r) => ({
      vehicleNo: r.vehicle_no,
      year: r.year ?? null,
      mmcode: r.mmcode ?? null,
      vin: r.vin_number ?? null,
      colour: r.colour ?? null,
      mileage: r.mileage ?? null,
      sellingPrice: r.selling_price ?? null,
      condition: String(r.department || '').toUpperCase() === 'NEW' ? 'new' : 'used',
    }));
    return jsonResponse({ units }, 200, origin, env);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', type: 'vehicle_stock_units_failed', error: String(err.message).slice(0, 200) }));
    return jsonResponse({ error: 'Could not load vehicles' }, 500, origin, env);
  }
}
