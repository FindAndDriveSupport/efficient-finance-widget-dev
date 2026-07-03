/**
 * prediction.js — Step 2: Run Prediction
 * POST /api/financing/prediction
 */

import { seritiRequest } from '../services/seritiAuth.js';
import { fetchApplicantRaw } from './getApplicant.js';

// Map prediction labels per spec — moved above the try/catch so the
// IDAS-failure fallback below can reuse it too.
const predictionMap = {
  Low:    { label: 'In progress',  headline: "Let's move forward with your application!", body: "We'll contact you to guide you through the next steps and explore the best options together." },
  Medium: { label: 'Good news',    headline: 'You have a good chance of qualifying!',     body: 'Your profile looks promising. Complete your application and we\'ll be in touch shortly.' },
  High:   { label: 'Great news',   headline: 'You\'re likely to qualify!',                body: 'Your profile looks great. Submit your application and we\'ll help you get into your next car.' },
};

export async function handlePrediction(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env); }

  const { applicantId, grossIncome, idNumber, hasSAID, hasNoSAID, livingExpenses } = body;

  if (!applicantId) {
    return jsonResponse({ error: 'Missing applicantId' }, 400, origin, env);
  }

  // ID validation (skip if no SA ID)
  const noSAID = hasNoSAID || !hasSAID;
  if (!noSAID) {
    const idError = validateSAID(idNumber);
    if (idError) return jsonResponse({ error: idError }, 400, origin, env);
  }

  const seritiPayload = {
    applicantId,
    grossIncome: Number(grossIncome) || 0,
    netIncome: Number(body.netIncome) || 0,
    emailAddress: body.email || '',
    ...(!noSAID && idNumber ? { idNumber } : {}),
  };

  console.log(JSON.stringify({
    level: 'info',
    type: 'seriti_prediction_request',
    dealerKey: dealerConfig?.key,
    applicantId,
    payload: seritiPayload,
    ts: new Date().toISOString(),
  }));

  let result;
  try {
    result = await seritiRequest('/api/Financing/Prediction', {
      method: 'POST',
      body: JSON.stringify(seritiPayload),
    }, env, dealerConfig?.key);
  } catch (err) {
    const msg = err.message || '';

    // 409 — Prediction already calculated, use PATCH to retrieve it
    if (msg.includes('409')) {
      try {
        result = await seritiRequest('/api/Financing/Prediction', {
          method: 'PATCH',
          body: JSON.stringify({
            applicantId,
            netIncome: Number(body.netIncome) || 0,
            livingExpenses: 0,
          }),
        }, env, dealerConfig?.key);
      } catch (patchErr) {
        console.error(JSON.stringify({
          level: 'error',
          type: 'seriti_prediction_patch_error',
          dealerKey: dealerConfig?.key,
          applicantId,
          error: patchErr.message,
          ts: new Date().toISOString(),
        }));
        return jsonResponse({ error: 'Seriti API error', details: patchErr.message }, 502, origin, env);
      }
    } else {
      // Check if the error is an IDAS bureau failure (no credit profile found,
      // or — as seen 2026-07-03 — an unhandled server-side FormatException
      // when IDAS returns an address record with a blank date field)
      const isIdasFailure = msg.includes('500') && msg.includes('Idas');
      const isSystemDown = !isIdasFailure && (msg.includes('502') || msg.includes('503') || msg.includes('500') || msg.includes('unavailable') || msg.includes('Bad Gateway'));

      if (isIdasFailure) {
        console.error(JSON.stringify({
          level: 'error',
          type: 'seriti_idas_failure',
          dealerKey: dealerConfig?.key,
          applicantId,
          error: msg.substring(0, 500),
          ts: new Date().toISOString(),
        }));

        // Fallback: Seriti may already hold a prediction for this applicant
        // from an earlier successful run (e.g. during pre-qualification, or
        // a prior attempt before this bug started tripping). Only trust it
        // if the income figures on file still match what's being submitted
        // now — otherwise a stale prediction could mislead the applicant.
        try {
          const applicantData = await fetchApplicantRaw(applicantId, env, dealerConfig?.key);
          const cached = applicantData?.applicantPrediction;
          const financeOnFile = applicantData?.applicant?.applicantFinance || {};

          const grossMatches = Number(financeOnFile.grossIncome) === seritiPayload.grossIncome;
          const netMatches = Number(financeOnFile.netIncome) === seritiPayload.netIncome;

          if (cached?.chancesOfApproval && grossMatches && netMatches) {
            console.log(JSON.stringify({
              level: 'info',
              type: 'seriti_prediction_fallback_used',
              dealerKey: dealerConfig?.key,
              applicantId,
              ts: new Date().toISOString(),
            }));

            return jsonResponse({
              prediction: predictionMap[cached.chancesOfApproval] || predictionMap.Low,
              reason: cached.improvementSuggestionFull,
              estimatedApprovalAmount: cached.estimatedApprovalAmount,
              monthlyInstalment: cached.estimatedFinanceSpend,
              source: 'cached',
            }, 200, origin, env);
          }

          console.log(JSON.stringify({
            level: 'info',
            type: 'seriti_prediction_fallback_unavailable',
            dealerKey: dealerConfig?.key,
            applicantId,
            reason: !cached?.chancesOfApproval ? 'no_cached_prediction' : 'income_mismatch',
            ts: new Date().toISOString(),
          }));
        } catch (fallbackErr) {
          console.error(JSON.stringify({
            level: 'error',
            type: 'seriti_prediction_fallback_failed',
            dealerKey: dealerConfig?.key,
            applicantId,
            error: fallbackErr.message,
            ts: new Date().toISOString(),
          }));
          // fall through to the idasFailed response below
        }

        return jsonResponse({
          error: 'No credit bureau information found for this ID number.',
          code: 500,
          idasFailed: true,
        }, 200, origin, env);
      }

      if (isSystemDown) {
        console.error(JSON.stringify({
          level: 'error',
          type: 'seriti_system_down',
          dealerKey: dealerConfig?.key,
          applicantId,
          error: msg,
          ts: new Date().toISOString(),
        }));
        return jsonResponse({
          error: 'Seriti systems are temporarily unavailable. Please try again in a few minutes.',
          code: 502,
          systemDown: true,
        }, 502, origin, env);
      }
      console.error(JSON.stringify({
        level: 'error',
        type: 'seriti_prediction_error',
        dealerKey: dealerConfig?.key,
        applicantId,
        error: msg,
        ts: new Date().toISOString(),
      }));
      return jsonResponse({ error: 'Seriti API error', details: err.message }, 502, origin, env);
    }
  }

  // Also check if result itself indicates a system error
  if (result?.statusCode === 502 || result?.statusCode === 503 || result?.systemDown) {
    return jsonResponse({
      error: 'Seriti systems are temporarily unavailable. Please try again in a few minutes.',
      code: 502,
      systemDown: true,
    }, 502, origin, env);
  }

  const predResponse = result.predictionResponse || {};
  const predNum = predResponse.prediction ?? -1;
  const predKey = predNum === 2 ? 'High' : predNum === 1 ? 'Medium' : 'Low';

  return jsonResponse({
    prediction: predictionMap[predKey] || predictionMap.Low,
    reason: predResponse.reason,
    estimatedApprovalAmount: predResponse.estimatedApprovalAmount,
    monthlyInstalment: predResponse.estimatedFinanceSpend,
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
