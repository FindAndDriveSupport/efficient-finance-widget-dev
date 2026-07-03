/**
 * getApplicant.js — Get applicant data after consent
 * GET /api/financing/applicant?applicantId=xxx
 *
 * Proxies to Seriti GET /api/Financing/GetApplicantById
 * Returns mapped fields for Edith CreatePolicy pre-fill (Step 3)
 */
import { seritiRequest } from '../services/seritiAuth.js';

/**
 * Fetches the raw Seriti applicant payload (unmapped) so callers other than
 * the HTTP route — e.g. the prediction.js IDAS-failure fallback — can read
 * fields like applicantPrediction and applicantFinance directly, without
 * going through the trimmed/mapped shape returned to the frontend.
 *
 * Throws on any error (including 404) — callers decide how to handle it.
 */
export async function fetchApplicantRaw(applicantId, env, dealerKey) {
  const result = await seritiRequest(
    `/api/Financing/GetApplicantById?id=${encodeURIComponent(applicantId)}`,
    { method: 'GET' },
    env,
    dealerKey
  );
  return result.response || {};
}

export async function handleGetApplicant(request, ctx, jsonResponse) {
  const { env, origin, dealerConfig } = ctx;
  const url = new URL(request.url);
  const applicantId = url.searchParams.get('applicantId');

  if (!applicantId) {
    return jsonResponse({ error: 'Missing applicantId' }, 400, origin, env);
  }

  let response;
  try {
    response = await fetchApplicantRaw(applicantId, env, dealerConfig?.key);
  } catch (err) {
    // Seriti returns 404 when the applicant genuinely doesn't exist yet —
    // this is expected (e.g. user hasn't completed pre-qualification),
    // not a system failure. Only treat non-404 errors as 502.
    if (err.status === 404 || /not found/i.test(err.message)) {
      console.log(JSON.stringify({
        level: 'info',
        type: 'applicant_not_found',
        applicantId,
        dealerKey: dealerConfig?.key,
        ts: new Date().toISOString(),
      }));
      return jsonResponse({ error: 'Applicant not found' }, 404, origin, env);
    }

    console.error(JSON.stringify({
      level: 'error',
      type: 'get_applicant_error',
      applicantId,
      dealerKey: dealerConfig?.key,
      error: err.message,
      ts: new Date().toISOString(),
    }));
    return jsonResponse({ error: 'Seriti API error', details: err.message }, 502, origin, env);
  }

  const applicant  = response.applicant || {};
  const address    = applicant.applicantAddress || {};
  const employment = applicant.applicantEmploymentHistory || {};
  const finance    = applicant.applicantFinance || {};
  const prediction = response.applicantPrediction || null;

  return jsonResponse({
    // Personal
    title:        applicant.title,
    firstName:    applicant.firstName,
    lastName:     applicant.lastName,
    mobileNumber: applicant.mobileNumber,
    emailAddress: applicant.emailAddress,
    idNumber:     applicant.idNumber,
    gender:       applicant.gender,
    dateOfBirth:  applicant.dateOfBirth,
    maritalStatus: applicant.maritalStatus,
    // Address
    address1:          address.line1,
    suburb:            address.township,
    township:          address.township,
    city:              address.city,
    province:          address.province,
    postCode:          address.postalCode,
    residentialStatus: address.residentialStatus,
    // Employment
    employmentType:             employment.employmentType,
    employerName:               applicant.latestCompanyName,
    industry:                   employment.industry,
    occupation:                 employment.occupation,
    occupationLevel:            employment.level,
    currentEmploymentStartDate: employment.employmentDate,
    salaryDay:                  employment.remunerationDate,
    // Financials
    grossIncome:    finance.grossIncome,
    netIncome:      finance.netIncome,
    bureauExpenses: finance.bureauExpenses,
    // Next of kin
    nokFirst:   applicant.nextOfKinFirstName,
    nokLast:    applicant.nextOfKinLastName,
    nokContact: applicant.nextOfKinContactNumber,
    // Cached prediction (if Seriti already ran one for this applicant) —
    // used as a fallback source when a live /prediction call fails.
    cachedPrediction: prediction ? {
      chancesOfApproval:        prediction.chancesOfApproval,
      estimatedApprovalAmount:  prediction.estimatedApprovalAmount,
      estimatedFinanceSpend:    prediction.estimatedFinanceSpend,
      estimatedInsuranceSpend:  prediction.estimatedInsuranceSpend,
      improvementSuggestionFull: prediction.improvementSuggestionFull,
    } : null,
  }, 200, origin, env);
}
