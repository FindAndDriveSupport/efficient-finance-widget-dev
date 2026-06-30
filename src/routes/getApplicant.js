/**
 * getApplicant.js — Get applicant data after consent
 * GET /api/financing/applicant?applicantId=xxx
 *
 * Proxies to Seriti GET /api/Financing/GetApplicantById
 * Returns mapped fields for Edith CreatePolicy pre-fill (Step 3)
 */

import { seritiRequest } from '../services/seritiAuth.js';

export async function handleGetApplicant(request, ctx, jsonResponse) {
  console.log('[getApplicant] handler called');  // ← add this line
  const { env, origin } = ctx;
  const url = new URL(request.url);
  const applicantId = url.searchParams.get('applicantId');

  if (!applicantId) {
    return jsonResponse({ error: 'Missing applicantId' }, 400, origin, env);
  }

  let result;
  try {
    result = await seritiRequest(
      `/api/Financing/GetApplicantById?applicantId=${encodeURIComponent(applicantId)}`,
      { method: 'GET' },
      env
    );
    console.log('[getApplicant] raw result:', JSON.stringify(result).slice(0, 500));
  } catch (err) {
    console.error('[getApplicant] seritiRequest failed:', err.message);
    return jsonResponse({ error: 'Failed to fetch applicant', detail: err.message }, 500, origin, env);
  }

  const applicant  = result.response?.applicant || {};
  const address    = applicant.applicantAddress || {};
  const employment = applicant.applicantEmploymentHistory || {};
  const finance    = applicant.applicantFinance || {};

  return jsonResponse({
    // Personal
    title:        applicant.title,
    firstName:    applicant.firstName,
    lastName:     applicant.lastName,
    mobileNumber: applicant.mobileNumber,
    emailAddress: applicant.emailAddress,
    idNumber:     applicant.idNumber,
    gender:       applicant.gender,
    maritalStatus: applicant.maritalStatus,
    // Address
    address1:          address.line1,
    suburb:            address.township,
    city:              address.city,
    province:          address.province,
    postCode:          address.postalCode,
    residentialStatus: address.residentialStatus,
    // Employment
    employmentType:             employment.employmentType,
    employerName:               employment.companyName,
    industry:                   employment.industry,
    occupation:                 employment.occupation,
    occupationLevel:            employment.level,
    currentEmploymentStartDate: employment.employmentDate,
    salaryDay:                  employment.remunerationDate,
    // Financials
    bureauExpenses: finance.bureauExpenses,
    // Next of kin
    nokFirst:   applicant.nextOfKinFirstName,
    nokLast:    applicant.nextOfKinLastName,
    nokContact: applicant.nextOfKinContactNumber,
  }, 200, origin, env);
}