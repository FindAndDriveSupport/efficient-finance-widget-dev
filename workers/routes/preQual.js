/**
 * preQual.js — Step 1: Pre-Qualification
 * POST /api/financing/pre-qualification
 *
 * Proxies to Seriti POST /api/Financing/Pre-Qualification
 * Injects branchCode from dealer config.
 */
import { seritiRequest } from '../services/seritiAuth.js';

export async function handlePreQual(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env);
  }
  // Validate required fields
  const required = ['firstName', 'lastName', 'netIncome', 'mobileNumber'];
  for (const field of required) {
    if (!body[field] && body[field] !== 0) {
      return jsonResponse({ error: `Missing required field: ${field}` }, 400, origin, env);
    }
  }
  // Validate SA mobile number
  if (!isValidSAMobile(body.mobileNumber)) {
    return jsonResponse({
      error: 'Invalid mobile number. Use a valid 10-digit SA number (e.g. 0821234567).'
    }, 400, origin, env);
  }
  // Build Seriti payload
  const seritiPayload = {
    firstName: body.firstName,
    lastName: body.lastName,
    netIncome: Number(body.netIncome),
    mobileNumber: formatMobile(body.mobileNumber),
    hasDeposit: body.hasDeposit || false,
    hasExistingFinance: body.hasExistingFinance || false,
    deposit: Number(body.depositAmount) || 0,
    currentInstalment: Number(body.financeAmount) || 0,
    branchCode: dealerConfig.branchCode,
    // Always sent (not conditionally omitted like before) — defaults to
    // "None" when the applicant skipped vehicle selection (step 0), rather
    // than leaving the field out of the request entirely. vehicleCondition
    // is new and routes identically to make/model.
    vehicleMake: body.vehicleMake || 'None',
    vehicleModel: body.vehicleModel || 'None',
    vehicleCondition: body.vehicleCondition || 'None',
    // vehicleMm (manufacturer model code) stays conditional — it's a lookup
    // code, not part of the user-facing selection, so there's no sensible
    // "None" default for it.
    ...(body.vehicleMm ? { vehicleMm: body.vehicleMm } : {}),
    // dealershipId — Seriti's carFinanceDealershipBranchId GUID, sourced
    // from dealers.config.js (property name `dealershipID`, matched there
    // by branchCode). Only included if the dealer has one on record.
    // NOTE: the outgoing key must be exactly `dealershipId` (lowercase d,
    // capital I, lowercase d) to match Seriti's Pre-Qualification schema.
    ...(dealerConfig.dealershipID ? { dealershipId: dealerConfig.dealershipID } : {}),
  };
  let result;
  try {
    result = await seritiRequest('/api/Financing/Pre-Qualification', {
      method: 'POST',
      body: JSON.stringify(seritiPayload),
    }, env, dealerConfig?.key);
  } catch (err) {
    return jsonResponse({ error: 'Seriti API error', details: err.message }, 502, origin, env);
  }
  // Return only what the frontend needs
  return jsonResponse({
    totalAmount: result.totalAmount,
    monthlyAmount: result.monthlyAmount,
    applicantId: result.applicantId,
  }, 200, origin, env);
}

// ── Helpers ───────────────────────────────────────────────────
const VALID_PREFIXES = ['060','061','062','063','064','065','066','067','068','069',
  '071','072','073','074','075','076','077','078','079',
  '081','082','083','084','085','086','087'];

function isValidSAMobile(number) {
  if (!number) return false;
  const cleaned = number.replace(/\s|-/g, '');
  if (/^01/.test(cleaned)) return false;
  if (!/^0[6-8]\d{8}$/.test(cleaned)) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  return true;
}

function formatMobile(number) {
  const cleaned = number.replace(/\s|-/g, '');
  if (cleaned.startsWith('+27')) return cleaned;
  if (cleaned.startsWith('27')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+27' + cleaned.slice(1);
  return '+27' + cleaned;
}
