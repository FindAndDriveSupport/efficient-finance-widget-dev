/**
 * completeApplicant.js — Confirms applicant journey completion with Seriti
 * POST /api/Financing/applicant/{id}/complete
 *
 * Called internally by createPolicy.js immediately after a successful
 * Edith policy creation, to mark the lead as fully converted in Seriti.
 * Fire-and-forget — failure here never blocks or alters the user's
 * success experience, but is logged/alerted for follow-up.
 */
import { seritiRequest } from '../services/seritiAuth.js';

export async function completeApplicant({ env, dealerConfig, applicantId, salesRef, policyNumber }) {
  if (!applicantId) {
    console.warn(JSON.stringify({
      level: 'warn',
      type: 'complete_applicant_skipped_no_id',
      salesRef,
      policyNumber,
      dealerKey: dealerConfig?.key,
      ts: new Date().toISOString(),
    }));
    return;
  }

  try {
    await seritiRequest(
      `/api/Financing/applicant/${encodeURIComponent(applicantId)}/complete`,
      { method: 'POST' },
      env,
      dealerConfig?.key
    );

    console.log(JSON.stringify({
      level: 'info',
      type: 'complete_applicant_success',
      applicantId,
      salesRef,
      policyNumber,
      dealerKey: dealerConfig?.key,
      ts: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'complete_applicant_failed',
      applicantId,
      salesRef,
      policyNumber,
      dealerKey: dealerConfig?.key,
      error: err.message,
      ts: new Date().toISOString(),
    }));
  }
}
