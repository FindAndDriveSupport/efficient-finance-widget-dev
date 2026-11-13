/**
 * routes/partialLead.js
 * Receives a drop-off/partial lead via sendBeacon from a finance app
 * before the applicant completes a full submission, and forwards it to
 * queue-worker's confirmed POST /process-lead contract for CRM delivery
 * (DealerOS).
 *
 * KV binding: LEADS_SYNC_CONFIG. One JSON record per dealer, keyed by the
 * dealer's key (e.g. "car-factory-outlet"), containing a `destinations`
 * array — confirmed shape:
 * {
 *   key, groupKey, branchCode, seritiApiKey, seritiApiSecret,
 *   seritiDealershipId, startDate, kredoEnabled, kredoUsername,
 *   kredoPassword, kredoXApiKey,
 *   destinations: [{ dealerosToken, dealershipId, enquiryMethod, leadSource, type }]
 * }
 */

export async function handlePartialLead(request, ctx, jsonResponse) {
  const { env, origin, dealerConfig } = ctx;
  const body = await request.json();
  const { dealerKey, firstName, lastName, idNumber, mobileNumber, vehicleMake, vehicleModel } = body;

  const raw = await env.LEADS_SYNC_CONFIG?.get(dealerKey);
  if (!raw) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'partial_lead_dealer_config_missing',
      dealerKey,
      ts: new Date().toISOString(),
    }));
    return new Response(null, { status: 202 }); // sendBeacon has no client-side error handling anyway
  }

  let dealerRecord;
  try {
    dealerRecord = JSON.parse(raw);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'partial_lead_dealer_config_parse_failed',
      dealerKey,
      error: err.message,
      ts: new Date().toISOString(),
    }));
    return new Response(null, { status: 202 });
  }

  const dest = (dealerRecord.destinations || []).find(d => d.type === 'dealeros');
  if (!dest) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'partial_lead_dealeros_dest_missing',
      dealerKey,
      ts: new Date().toISOString(),
    }));
    return new Response(null, { status: 202 });
  }

  const lead = {
    firstName,
    lastName,
    idNumber,
    mobileNumber,
    vehicleMake,
    vehicleModel,
    date: new Date().toISOString().slice(0, 10),
  };

  ctx.waitUntil(
    env.QUEUE_WORKER.fetch('https://internal/process-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealerKey,
        branchCode: dealerConfig.branchCode,
        intent: 'incomplete application',
        lead,
        approvalChance: null,
        destinations: [dest],
      }),
    }).catch((err) => console.error('[partial-lead] queue-worker call failed:', err.message))
  );

  return new Response(null, { status: 202 });
}