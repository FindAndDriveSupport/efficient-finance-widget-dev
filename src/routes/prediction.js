/**
 * prediction.js — Step 2: Run Prediction
 * POST /api/financing/prediction
 */

import { seritiRequest } from '../services/seritiAuth.js';

export async function handlePrediction(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env); }

  const { applicantId, grossIncome, idNumber, hasNoSAID, livingExpenses } = body;

  if (!applicantId) {
    return jsonResponse({ error: 'Missing applicantId' }, 400, origin, env);
  }

  // ID validation (skip if hasNoSAID)
  if (!hasNoSAID) {
    const idError = validateSAID(idNumber);
    if (idError) return jsonResponse({ error: idError }, 400, origin, env);
  }

  const seritiPayload = {
    applicantId,
    grossIncome: Number(grossIncome),
    livingExpenses: Number(livingExpenses) || 0,
    ...(hasNoSAID ? { hasNoSAID: true } : { idNumber }),
  };

  const result = await seritiRequest('/api/Financing/Prediction', {
    method: 'POST',
    body: JSON.stringify(seritiPayload),
  }, env);

  // Map prediction labels per spec
  const predictionMap = {
    Low:    { label: 'In progress',  headline: "Let's move forward with your application!", body: "We'll contact you to guide you through the next steps and explore the best options together." },
    Medium: { label: 'Good news',    headline: 'You have a good chance of qualifying!',     body: 'Your profile looks promising. Complete your application and we\'ll be in touch shortly.' },
    High:   { label: 'Great news',   headline: 'You\'re likely to qualify!',                body: 'Your profile looks great. Submit your application and we\'ll help you get into your next car.' },
  };
  const predKey = typeof result.prediction === 'string'
    ? result.prediction.charAt(0).toUpperCase() + result.prediction.slice(1).toLowerCase()
    : 'Low';

  return jsonResponse({
    prediction: predictionMap[predKey] || predictionMap.Low,
    reason: result.reason,
    estimatedApprovalAmount: result.estimatedApprovalAmount,
    monthlyInstalment: result.estimatedFinanceSpend, // renamed per spec
  }, 200, origin, env);
}

// ── SA ID Validation ──────────────────────────────────────────

function validateSAID(id) {
  if (!id || id.length !== 13 || !/^\d{13}$/.test(id)) {
    return 'ID number must be exactly 13 digits.';
  }
  if (/^(\d)\1+$/.test(id)) {
    return 'ID number appears to be invalid (all digits the same).';
  }
  if (!validDate(id)) {
    return 'ID number contains an invalid date of birth.';
  }
  if (!luhnCheck(id)) {
    return 'ID number is not valid. Please check it matches your ID document exactly.';
  }
  return null;
}

function validDate(id) {
  const yy = parseInt(id.substring(0, 2));
  const mm = parseInt(id.substring(2, 4));
  const dd = parseInt(id.substring(4, 6));
  const fullYear = yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy;
  const date = new Date(fullYear, mm - 1, dd);
  return date.getFullYear() === fullYear && date.getMonth() === mm - 1 && date.getDate() === dd;
}

function luhnCheck(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sumOdd = 0;
  for (let i = 0; i < 12; i += 2) sumOdd += parseInt(id[i]);
  let evenDigits = '';
  for (let i = 1; i < 12; i += 2) evenDigits += id[i];
  let doubled = (parseInt(evenDigits) * 2).toString();
  let sumEven = doubled.split('').reduce((a, b) => a + parseInt(b), 0);
  const total = sumOdd + sumEven;
  const checkDigit = (10 - (total % 10)) % 10;
  return checkDigit === parseInt(id[12]);
}
