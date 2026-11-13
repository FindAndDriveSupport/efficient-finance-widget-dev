/**
 * createPolicy.js — Step 3: Submit Application → Edith CreatePolicy
 * POST /api/policy/create
 *
 * Calls Edith webservice CreatePolicy with full field mapping.
 * Uses edithErrors.js error classification for user-facing messages.
 * Logs all errors to Cloudflare structured logging for CI/CD observability.
 *
 * Failure handling:
 *   - Genuine network failures (fetch throws) → retry up to 3 times
 *   - On exhausted retries → record in D1 policy_events, email dealer, return success to user
 *   - Edith system errors (500 response) → record in D1, email dealer, return success to user
 *
 * Optional fields (race, education, expenses, bank account on non-bike deals)
 * never block a policy: bad values are cleaned up before sending, and if Edith
 * still rejects ONLY optional fields the request is re-sent once without them.
 *
 * On any real success (clean or with warnings), fires a fire-and-forget
 * call to Seriti's applicant/{id}/complete endpoint to mark the lead as
 * fully converted. This never blocks or alters the user's response.
 */

import { SYSTEM_MESSAGES, parseEdithErrors } from '../utils/edithErrors.js';
import { completeApplicant } from './completeApplicant.js';
import { recordProgressEvent } from './progress.js';
import { recordSubmissionReview } from './documentIntegrity.js';

// YONDA Service Fee — defaults applied for financeType === 'bike'
const YONDA_SERVICE_FEE = {
  productOptionId: '73921',
  price: '2990.00', // R2,990 including VAT
};

const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

export async function handleCreatePolicy(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin, ctx: workerCtx } = ctx;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env);
  }
  body = sanitizeOptionalFields(body, dealerConfig.financeType === 'bike');

  // Select Edith credentials and WSDL URL based on dealer's edithEnv
  const isProd = dealerConfig.edithEnv === 'prod';
  const companyCode = isProd ? env.EDITH_COMPANY_CODE_PROD : env.EDITH_COMPANY_CODE;
  const companyPass = isProd ? env.EDITH_COMPANY_PASS_PROD : env.EDITH_COMPANY_PASS;
  const wsdlUrl = isProd ? env.EDITH_WSDL_URL_PROD : env.EDITH_WSDL_URL;

  // Apply branch code override from frontend — for multi-branch dealer groups
  if (body.branchCodeOverride && /^[A-Z0-9]{4,12}$/.test(body.branchCodeOverride)) {
    dealerConfig.branchCode = body.branchCodeOverride;
  }

  const salesRef = generateSalesRef(dealerConfig.branchCode);

  // Step-by-step progress tracking (no-op unless the frontend sent a sessionId).
  // Never blocks or alters the response.
  const track = (event, extra = {}) => {
    if (!body.sessionId) return;
    workerCtx?.waitUntil(recordProgressEvent(env, {
      sessionId: body.sessionId,
      dealerKey: dealerConfig.key,
      step: event === 'failed' ? 'documents' : 'submitted',
      event,
      idNumber: body.idNumber,
      name: [body.firstName, body.lastName].filter(Boolean).join(' '),
      mobile: body.mobileNumber,
      vehicle: [body.vehicleMake, body.vehicleModel].filter(Boolean).join(' '),
      salesRef,
      ...extra,
    }));
  };
  const xml = buildEdithXML(body, companyCode, companyPass, dealerConfig, salesRef);

  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_create_policy_request',
    salesRef,
    dealerKey: dealerConfig.key,
    branchCode: dealerConfig.branchCode,
    branchOverrideApplied: !!body.branchCodeOverride,
    edithEnv: dealerConfig.edithEnv || 'dev',
    fields: {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      idType: body.idType || null,
      idNumber: body.idNumber ? '✓' : null,
      mobile: body.mobileNumber ? '✓' : null,
      email: body.emailAddress ? '✓' : null,
      maritalStatus: body.maritalStatus || null,
      marriageType: body.marriageType || null,
      educationLevel: body.educationLevel || null,
      employmentType: body.employmentType || null,
      employerName: body.employerName ? '✓' : null,
      occupation: body.occupation || null,
      occupationLevel: body.occupationLevel || null,
      industry: body.industry || null,
      workTelephoneCode: body.workTelephoneCode || null,
      workTelephoneNumber: body.workTelephoneNumber ? '✓' : null,
      basicSalary: body.basicSalary ? '✓' : null,
      nettSalary: body.nettSalary ? '✓' : null,
      depositAmount: body.depositAmount ? '✓' : null,
      retailPrice: body.retailPrice ? '✓' : null,
      address1: body.address1 ? '✓' : null,
      suburb: body.suburb || null,
      city: body.city || null,
      postCode: body.postCode || null,
      residentialStatus: body.residentialStatus || null,
      bankBranchCode: body.bankBranchCode || null,
      accountType: body.accountType || null,
      accountNumber: body.bankAccountNumber ? '✓' : null,
      ethnicGroup: body.ethnicGroup || null,
      nextOfKinFirst: body.nextOfKinFirstName ? '✓' : null,
      nextOfKinLast: body.nextOfKinLastName ? '✓' : null,
      nextOfKinMobile: body.nextOfKinMobile ? '✓' : null,
      nextOfKinEmail: body.nextOfKinEmail ? '✓' : null,
      dataAttestation: body.dataAttestation ? '✓' : null,
      financialAccessConsent: body.financialAccessConsent ? '✓' : null,
    },
    ts: new Date().toISOString(),
  }));

  // ── TEMPORARY DEBUG LOG — remove once the mobile-number-rejected-by-Edith
  // investigation is closed out. Logs the exact digits sent to Edith inside
  // <tem:MobileNumber> so a rejected number can be compared against what
  // was captured pre-normalisation in D1 (policy_events.applicant_mobile).
  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_outbound_mobile_debug',
    salesRef,
    mobileNumberRaw: body.mobileNumber || null,
    mobileNumberNormalised: body.mobileNumber ? normaliseMobile(body.mobileNumber) : null,
    ts: new Date().toISOString(),
  }));

  // ── Fetch with retry (network failures only) ──────────────────
  let { rawText, fetchStatus, networkFailure, retryCount } =
    await postToEdith({ wsdlUrl, xml, env, dealerConfig, salesRef });

  // ── All retries exhausted — genuine network failure ───────────
  if (networkFailure) {
    const failureReason = `Network failure after ${RETRY_LIMIT} attempts — Edith unreachable`;
    track('manual_followup', { detail: failureReason });
    workerCtx?.waitUntil(
      recordFailure({
        env,
        dealerConfig,
        body,
        salesRef,
        edithResponse: null,
        failureReason,
        retryCount,
      })
    );
    workerCtx?.waitUntil(
      notifyDealer({
        env,
        dealerConfig,
        body,
        salesRef,
        failureReason,
      })
    );
    return jsonResponse({
      success: true,
      manualFollowUp: true,
      salesRef,
      code: 100,
    }, 200, origin, env);
  }

  // ── Got a response — log and parse ───────────────────────────
  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_create_policy_response',
    salesRef,
    status: fetchStatus,
    body: rawText,
    ts: new Date().toISOString(),
  }));

  let edithResponse = parseEdithXMLResponse(rawText);

  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_parsed',
    salesRef,
    statusCode: edithResponse.statusCode,
    policyNumber: edithResponse.policyNumber,
    errorCount: edithResponse.errors.length,
    ts: new Date().toISOString(),
  }));

  // ── Optional-field fallback ───────────────────────────────────
  // If Edith rejected the application ONLY because of optional fields
  // (race, education, expenses, bank details on non-bike deals), re-send once
  // without them so the policy is still created.
  let droppedFields = [];
  const droppable = getDroppableFields(edithResponse, dealerConfig.financeType === 'bike');
  if (droppable.length > 0) {
    logWarning('edith_optional_fields_dropped', { fields: droppable }, env, { salesRef, dealerKey: dealerConfig.key });
    const second = await postToEdith({
      wsdlUrl, xml: stripFields(xml, droppable), env, dealerConfig, salesRef,
    });
    if (!second.networkFailure) {
      rawText = second.rawText;
      fetchStatus = second.fetchStatus;
      retryCount = (retryCount || 0) + 1 + (second.retryCount || 0);
      edithResponse = parseEdithXMLResponse(rawText);
      droppedFields = droppable;
      console.log(JSON.stringify({
        level: 'info',
        type: 'edith_parsed_after_dropping_optional',
        salesRef,
        statusCode: edithResponse.statusCode,
        policyNumber: edithResponse.policyNumber,
        errorCount: edithResponse.errors.length,
        droppedFields,
        ts: new Date().toISOString(),
      }));
    }
  }

  // ── Edith system-level error (500) ────────────────────────────
  if (edithResponse.statusCode === 500) {
    const failureReason = `Edith system error 500 — ${edithResponse.systemMessage || 'System failure'}`;
    track('manual_followup', { detail: failureReason });
    workerCtx?.waitUntil(
      recordFailure({
        env,
        dealerConfig,
        body,
        salesRef,
        edithResponse: rawText,
        failureReason,
        retryCount,
      })
    );
    workerCtx?.waitUntil(
      notifyDealer({
        env,
        dealerConfig,
        body,
        salesRef,
        failureReason,
      })
    );
    logError('edith_system_error_500', { salesRef, failureReason }, env, {
      dealerKey: dealerConfig.key,
    });
    return jsonResponse({
      success: true,
      manualFollowUp: true,
      salesRef,
      code: 100,
    }, 200, origin, env);
  }

  // ── Other system-level errors (400, 410, 420) ─────────────────
  const sysCode = edithResponse.statusCode;
  if (SYSTEM_MESSAGES[sysCode]) {
    const msg = SYSTEM_MESSAGES[sysCode];
    logError('edith_system_error', { code: sysCode, internal: msg.internal }, env, { salesRef });
    track('failed', { detail: `Edith system code ${sysCode}` });
    return jsonResponse({
      error: msg.title,
      message: msg.message,
      action: msg.action,
      code: sysCode,
    }, 422, origin, env);
  }

  // ── Field-level errors ────────────────────────────────────────
  if (edithResponse.errors && edithResponse.errors.length > 0) {
    const parsedErrors = parseEdithErrors(edithResponse.errors);
    const fatal = parsedErrors.filter(e => e.severity === 'error');
    const warnings = parsedErrors.filter(e => e.severity === 'warning');

    if (fatal.length > 0) {
      logError('edith_field_errors', fatal, env, { salesRef });
      track('failed', { detail: edithResponse.errors.filter((e) => Number(e.StatusCode) >= 300).map((e) => e.FieldName).join(', ') });
      return jsonResponse({
        success: false,
        policyNumber: edithResponse.policyNumber || null,
        errors: fatal,
        warnings,
        code: 300,
      }, 422, origin, env);
    }

    // Code 200 — success with warnings
    logWarning('edith_field_warnings', warnings, env, { salesRef });
    track('submitted', { policyNumber: edithResponse.policyNumber });
    workerCtx?.waitUntil(recordSubmissionReview(env, body.sessionId, salesRef, body.idNumber, body.applicationType === 'spouse' ? body.spouseIdNumber : undefined));
    writePolicyEvent({
      env,
      workerCtx,
      dealerConfig,
      body,
      salesRef,
      policyNumber: edithResponse.policyNumber,
      status: 'success',
      retryCount,
    });
    workerCtx?.waitUntil(
      completeApplicant({
        env,
        dealerConfig,
        applicantId: body.applicantId,
        salesRef,
        policyNumber: edithResponse.policyNumber,
      })
    );
    return jsonResponse({
      success: true,
      policyNumber: edithResponse.policyNumber,
      salesRef,
      warnings,
      ...(droppedFields.length ? { optionalFieldsDropped: droppedFields } : {}),
      code: 200,
    }, 200, origin, env);
  }

  // ── Clean success ─────────────────────────────────────────────
  const policyNumber = edithResponse.policyNumber;
  track('submitted', { policyNumber });
  workerCtx?.waitUntil(recordSubmissionReview(env, body.sessionId, salesRef, body.idNumber, body.applicationType === 'spouse' ? body.spouseIdNumber : undefined));
  writePolicyEvent({
    env,
    workerCtx,
    dealerConfig,
    body,
    salesRef,
    policyNumber,
    status: 'success',
    retryCount,
  });
  workerCtx?.waitUntil(
    completeApplicant({
      env,
      dealerConfig,
      applicantId: body.applicantId,
      salesRef,
      policyNumber,
    })
  );

  return jsonResponse({
    success: true,
    policyNumber,
    salesRef,
    ...(droppedFields.length ? { optionalFieldsDropped: droppedFields } : {}),
    code: droppedFields.length ? 200 : 100,
  }, 200, origin, env);
}

// ── Edith POST with network retry ─────────────────────────────

async function postToEdith({ wsdlUrl, xml, env, dealerConfig, salesRef }) {
  let rawText = null;
  let fetchStatus = null;
  let networkFailure = false;
  let retryCount = 0;

  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(wsdlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ws.edith.co.za/EdithServices/PolicyServicesV300/CreatePolicy',
        },
        body: xml,
      });
      rawText = await res.text();
      fetchStatus = res.status;
      networkFailure = false;
      retryCount = attempt;
      break;
    } catch (err) {
      retryCount = attempt + 1;
      networkFailure = true;
      logError('edith_network_error', { message: err.message, attempt: attempt + 1 }, env, {
        salesRef,
        dealerKey: dealerConfig.key,
      });
      if (attempt < RETRY_LIMIT - 1) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  return { rawText, fetchStatus, networkFailure, retryCount };
}

// ── Optional fields ───────────────────────────────────────────
//
// Fields the standalone application adds on top of the core application.
// None of them may block policy creation.

const ETHNIC_GROUPS = new Set(['ASIAN', 'BLACK', 'COLOURED', 'INDIAN', 'WHITE']);
const ACCOUNT_TYPES = new Set(['CHEQUE', 'SAVINGS', 'TRANSMISSION']);

const OPTIONAL_MONEY_FIELDS = [
  'monthlyRentExpense', 'monthlyFoodExpense', 'monthlyOtherExpense', 'loanRepayments', 'vehicleRepayments',
  'insurancePayments', 'municipalPayments', 'creditCardPayments', 'furnitureAccountPayments',
  'clothingAccountPayments', 'overdraftPayments', 'telephonePayments', 'transportCosts', 'educationCosts',
  'childMaintenance', 'householdExpenses', 'securityPayments',
];

/**
 * Cleans optional values BEFORE they are sent (bank details are left untouched for bike deals): anything missing or malformed is
 * removed rather than sent to Edith. Returns a shallow copy; required fields
 * (name, ID, etc.) are never touched here.
 */
function sanitizeOptionalFields(input, isBike = false) {
  const b = { ...input };

  if (b.ethnicGroup != null) {
    const v = String(b.ethnicGroup).trim().toUpperCase();
    if (ETHNIC_GROUPS.has(v)) b.ethnicGroup = v; else delete b.ethnicGroup;
  }

  // Stock-unit vehicle fields: each is optional and dropped if it would not pass Edith's rules.
  if (b.chassisVinNumber != null) {
    const v = String(b.chassisVinNumber).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (v.length === 15 || v.length === 17) b.chassisVinNumber = v; else delete b.chassisVinNumber;
  }
  if (b.stockNumber != null) {
    const v = String(b.stockNumber).trim().slice(0, 20);
    if (v) b.stockNumber = v; else delete b.stockNumber;
  }
  if (b.vehicleColour != null) {
    const v = String(b.vehicleColour).trim().slice(0, 20);
    if (v) b.vehicleColour = v; else delete b.vehicleColour;
  }
  if (b.odometerReading != null) {
    const n = Math.round(Number(b.odometerReading));
    if (Number.isFinite(n) && n >= 0 && n < 2_000_000) b.odometerReading = n; else delete b.odometerReading;
  }

  // Countries: Edith's appendix names (upper case). Edith validates the exact value; an unknown one is dropped on retry.
  for (const k of ['birthCountry', 'residenceCountry']) {
    if (b[k] != null) {
      const v = String(b[k]).trim().toUpperCase();
      if (/^[A-Z][A-Z ()'.,-]{2,50}$/.test(v)) b[k] = v; else delete b[k];
    }
  }

  // Languages must be one of Edith's values (CorrespondenceLanguage has no OTHER).
  const LANGS = ['ENGLISH', 'AFRIKAANS', 'ISINDEBELE', 'ISIXHOSA', 'ISIZULU', 'SESOTHO SA LEBOWA', 'SESOTHO', 'SETSWANA', 'SISWATI', 'TSHIVENDA', 'XITSONGA'];
  if (b.homeLanguage != null) {
    const v = String(b.homeLanguage).trim().toUpperCase();
    if (LANGS.includes(v) || v === 'OTHER') b.homeLanguage = v; else delete b.homeLanguage;
  }
  if (b.correspondenceLanguage != null) {
    const v = String(b.correspondenceLanguage).trim().toUpperCase();
    if (LANGS.includes(v)) b.correspondenceLanguage = v; else delete b.correspondenceLanguage;
  }
  if (b.workAddress1 != null) {
    const v = String(b.workAddress1).trim().slice(0, 50);
    if (v) b.workAddress1 = v; else delete b.workAddress1;
  }

  if (b.taxNumber != null) {
    const t = String(b.taxNumber).replace(/\D/g, '');
    if (t.length >= 9 && t.length <= 20) b.taxNumber = t; else delete b.taxNumber;
  }

  // Spouse applications: the spouse's own employment, income and expenses. Each piece is optional and dropped when malformed.
  if (b.applicationType !== 'spouse') {
    for (const k of Object.keys(b)) if (k.startsWith('spouse') && !SPOUSE_IDENTITY_FIELDS.has(k)) delete b[k];
  } else {
    if (b.spouseTaxNumber != null) {
      const t = String(b.spouseTaxNumber).replace(/\D/g, '');
      if (t.length >= 9 && t.length <= 20) b.spouseTaxNumber = t; else delete b.spouseTaxNumber;
    }
    if (b.spouseEmploymentType != null && !['EMPLOYED', 'SELF-EMPLOYED', 'RETIRED'].includes(String(b.spouseEmploymentType))) delete b.spouseEmploymentType;
    if (b.spouseGender != null && !['MALE', 'FEMALE'].includes(String(b.spouseGender))) delete b.spouseGender;
    for (const k of ['spouseEmployerName', 'spouseOccupation']) {
      if (b[k] != null) { const v = String(b[k]).trim().slice(0, 100); if (v) b[k] = v; else delete b[k]; }
    }
    if (b.spouseEmploymentStartDate != null && !/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(String(b.spouseEmploymentStartDate))) delete b.spouseEmploymentStartDate;
    if (b.spouseSalaryDay != null) { const n = Number(b.spouseSalaryDay); if (Number.isInteger(n) && n >= 1 && n <= 31) b.spouseSalaryDay = n; else delete b.spouseSalaryDay; }
    for (const k of ['spouseBasicSalary', 'spouseNettSalary']) {
      if (b[k] != null) { const n = Number(b[k]); if (Number.isFinite(n) && n > 0) b[k] = n; else delete b[k]; }
    }
    if (b.spouseExpenses && typeof b.spouseExpenses === 'object' && !Array.isArray(b.spouseExpenses)) {
      const clean = {};
      for (const tag of SPOUSE_EXPENSE_TAGS) {
        const n = Number(b.spouseExpenses[tag]);
        if (Number.isFinite(n) && n > 0) clean[tag] = n;
      }
      b.spouseExpenses = clean;
    } else delete b.spouseExpenses;
  }

  for (const k of OPTIONAL_MONEY_FIELDS) {
    if (b[k] == null || b[k] === '') { delete b[k]; continue; }
    const n = Number(b[k]);
    if (Number.isFinite(n) && n > 0) b[k] = n; else delete b[k];
  }

  if (b.otherPaymentsDescription != null) {
    const v = String(b.otherPaymentsDescription).trim().slice(0, 100);
    if (v) b.otherPaymentsDescription = v; else delete b.otherPaymentsDescription;
  }

  if (b.nextOfKinEmail != null) {
    const v = String(b.nextOfKinEmail).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) b.nextOfKinEmail = v.slice(0, 100); else delete b.nextOfKinEmail;
  }

  // Bank details: a bank account needs a valid 6-digit branch code to be sent at
  // all; otherwise drop the whole block. A bad account type / number is dropped
  // individually.
  // Bike deals are left exactly as received: the debit-order account is essential
  // there, so Edith's own validation must still reach the applicant.
  const branch = b.bankBranchCode != null ? String(b.bankBranchCode).replace(/\D/g, '') : '';
  if (isBike) {
    // unchanged
  } else if (/^\d{6}$/.test(branch)) {
    b.bankBranchCode = branch;
    const type = b.accountType != null ? String(b.accountType).trim().toUpperCase() : '';
    if (ACCOUNT_TYPES.has(type)) b.accountType = type; else delete b.accountType;
    const acc = b.bankAccountNumber != null ? String(b.bankAccountNumber).replace(/\D/g, '') : '';
    if (acc && acc.length <= 20) b.bankAccountNumber = acc; else delete b.bankAccountNumber;
  } else {
    delete b.bankBranchCode;
    delete b.accountType;
    delete b.bankAccountNumber;
  }

  return b;
}

// Spouse fields that exist on every married applicant's request (name, ID); everything else on a spouse is for spouse applications only.
const SPOUSE_IDENTITY_FIELDS = new Set(['spouseTitle', 'spouseFirstName', 'spouseLastName', 'spouseIdNumber', 'spouseIdType']);
// Person expense elements the spouse may carry (same elements as the client).
const SPOUSE_EXPENSE_TAGS = [
  'LoanRepayments', 'VehicleRepayments', 'InsurancePayments', 'MunicipalPayments', 'BondRentPayments', 'CreditCardPayments',
  'FurnitureAccountPayments', 'ClothingAccountPayments', 'OverdraftPayments', 'TelephonePayments', 'TransportCosts',
  'FoodEntertainmentCosts', 'EducationCosts', 'ChildMaintenance', 'HouseHoldExpenses', 'OtherPayments', 'SecurityPayments',
];

// Edith element names (lower-case) that may be dropped if Edith rejects them.
const OPTIONAL_EDITH_FIELDS = new Set([
  'birthcountry', 'residencecountry', 'homelanguage', 'correspondencelanguage', 'employmentaddress', 'ethnicgroup', 'educationlevel', 'chassisvinnumber', 'stocknumber', 'colour', 'odometerreading', 'taxnumber', 'taxregisteredind', 'otherpaymentsdescription',
  'loanrepayments', 'vehiclerepayments', 'insurancepayments', 'municipalpayments', 'bondrentpayments',
  'creditcardpayments', 'furnitureaccountpayments', 'clothingaccountpayments', 'overdraftpayments',
  'telephonepayments', 'transportcosts', 'foodentertainmentcosts', 'educationcosts', 'childmaintenance',
  'householdexpenses', 'otherpayments', 'securitypayments',
]);
// Bank account fields are optional too — except on bike deals, where the
// debit-order account is essential and a bad value must still reach the user.
const OPTIONAL_BANK_FIELDS = new Set([
  'bankaccounts', 'bankaccount', 'accountnumber', 'accounttype', 'bankbranchcode',
  'accountholdername', 'primaryaccountind', 'creditcardtype',
]);

function fieldKey(name) {
  return String(name || '').replace(/\[[^\]]*\]/g, '').split(/[./]/).pop().trim().toLowerCase();
}

/**
 * Returns the Edith FieldNames to drop if (and only if) every data failure
 * (code 300) in the response is on an optional field. Otherwise [].
 */
function getDroppableFields(resp, isBike) {
  if (!resp || resp.statusCode !== 300 || !Array.isArray(resp.errors)) return [];
  const fatal = resp.errors.filter((e) => Number(e.StatusCode) >= 300);
  if (fatal.length === 0) return [];
  const isOptional = (name) => {
    const k = fieldKey(name);
    return OPTIONAL_EDITH_FIELDS.has(k) || (!isBike && OPTIONAL_BANK_FIELDS.has(k));
  };
  if (!fatal.every((e) => isOptional(e.FieldName))) return [];
  return [...new Set(fatal.map((e) => e.FieldName))];
}

/** Removes the named elements from the request XML (bank fields remove the whole BankAccounts block). */
function stripFields(xml, fieldNames) {
  let out = xml;
  for (const name of fieldNames) {
    const k = fieldKey(name);
    if (OPTIONAL_BANK_FIELDS.has(k)) {
      out = out.replace(/<tem:BankAccounts>[\s\S]*?<\/tem:BankAccounts>/g, '');
      continue;
    }
    const tag = k.replace(/[^a-z0-9]/g, '');
    out = out.replace(new RegExp(`<tem:${tag}>[\\s\\S]*?</tem:${tag}>`, 'gi'), '');
  }
  return out;
}

// ── Record failure in D1 ──────────────────────────────────────

async function recordFailure({ env, dealerConfig, body, salesRef, edithResponse, failureReason, retryCount }) {
  if (!env.DB) return;
  const applicantName = [body.firstName, body.lastName].filter(Boolean).join(' ') || null;
  try {
    await env.DB.prepare(`
      INSERT INTO policy_events (
        dealer_key, applicant_id, sales_ref, branch_code, finance_type,
        status, failure_reason, edith_response, request_payload,
        applicant_name, applicant_mobile, applicant_email, estimated_amount, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      dealerConfig.key,
      body.applicantId || null,
      salesRef,
      dealerConfig.branchCode,
      dealerConfig.financeType || 'vehicle',
      'failure',
      failureReason,
      edithResponse ? edithResponse.substring(0, 4000) : null,
      JSON.stringify(body).substring(0, 4000),
      applicantName,
      body.mobileNumber || null,
      body.emailAddress || null,
      body.estimatedApprovalAmount || body.preQualTotal || null,
      retryCount,
    )
    .run();
    console.log(JSON.stringify({
      level: 'info',
      type: 'policy_failure_recorded',
      salesRef,
      failureReason,
      ts: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'd1_failure_write_error',
      salesRef,
      error: err.message,
      ts: new Date().toISOString(),
    }));
  }
}

// ── Write success event to D1 ─────────────────────────────────
//
// Also stores vehicle year/make/model/condition and the applicant's split
// first/last name + ID number — none of this used to be captured here,
// but policy-sync-worker (a separate Worker) needs it to push a completed
// policy to all four CRMs + the email digest for the case where Seriti
// drops the lead from its feed entirely once it converts to a policy, so
// no normal lead sync ever happens for that customer. applicant_name
// (combined) is left in place unchanged alongside the new split columns —
// nothing reads it that would break, and nothing needs migrating off it.

function writePolicyEvent({ env, workerCtx, dealerConfig, body, salesRef, policyNumber, status, retryCount }) {
  if (!env.DB || !workerCtx) return;
  const applicantName = [body.firstName, body.lastName].filter(Boolean).join(' ') || null;
  workerCtx.waitUntil(
    env.DB.prepare(`
      INSERT INTO policy_events (
        dealer_key, policy_number, applicant_id, sales_ref, branch_code, finance_type,
        status, applicant_name, applicant_mobile, applicant_email,
        estimated_amount, retry_count, vehicle_year, vehicle_make, vehicle_model, vehicle_condition,
        applicant_first_name, applicant_last_name, applicant_id_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      dealerConfig.key,
      policyNumber || null,
      body.applicantId || null,
      salesRef,
      dealerConfig.branchCode,
      dealerConfig.financeType || 'vehicle',
      status,
      applicantName,
      body.mobileNumber || null,
      body.emailAddress || null,
      body.estimatedApprovalAmount || body.preQualTotal || null,
      retryCount || 0,
      body.vehicleYear || null,
      body.vehicleMake || null,
      body.vehicleModel || null,
      body.vehicleCondition || null,
      body.firstName || null,
      body.lastName || null,
      body.idNumber || null,
    )
    .run()
    .catch(err => console.error('D1 write failed:', err.message))
  );
}

// ── Notify dealer via Resend ──────────────────────────────────

async function notifyDealer({ env, dealerConfig, body, salesRef, failureReason }) {
  const contactEmail = dealerConfig.contactEmail;
  if (!contactEmail || !env.RESEND_API_KEY) return;

  const applicantName = [body.firstName, body.lastName].filter(Boolean).join(' ') || 'Unknown';
  const amount = body.estimatedApprovalAmount || body.preQualTotal;
  const formattedAmount = amount
    ? `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
    : 'Not available';

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #dc2626; margin-bottom: 4px;">⚠️ Finance Application — Manual Action Required</h2>
      <p style="color: #6b7280; margin-top: 0;">A finance application could not be automatically processed.</p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <strong>Reason:</strong> ${failureReason}
      </div>

      <h3 style="margin-bottom: 8px;">Applicant Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #6b7280; width: 160px;">Name</td><td style="padding: 6px 0;"><strong>${applicantName}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Mobile</td><td style="padding: 6px 0;">${body.mobileNumber || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${body.emailAddress || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">ID Number</td><td style="padding: 6px 0;">${body.idNumber || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Est. Approval</td><td style="padding: 6px 0;">${formattedAmount}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Branch</td><td style="padding: 6px 0; font-family: monospace;">${dealerConfig.branchCode}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Sales Ref</td><td style="padding: 6px 0; font-family: monospace;">${salesRef}</td></tr>
      </table>

      <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
        Please contact the applicant and submit the application manually if required.<br/>
        This notification was sent by the ${dealerConfig.name} finance widget.
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.ALERT_FROM_EMAIL || 'alerts@findndrive.co.za',
        to: [contactEmail],
        subject: `⚠️ Manual action required — Finance application for ${applicantName}`,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(JSON.stringify({
        level: 'error',
        type: 'dealer_notify_email_failed',
        salesRef,
        status: res.status,
        error: err,
        ts: new Date().toISOString(),
      }));
    } else {
      console.log(JSON.stringify({
        level: 'info',
        type: 'dealer_notify_email_sent',
        salesRef,
        to: contactEmail,
        ts: new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'dealer_notify_email_error',
      salesRef,
      error: err.message,
      ts: new Date().toISOString(),
    }));
  }
}

// ── Edith XML Builder ─────────────────────────────────────────

function buildEdithXML(data, companyCode, companyPass, dealer, salesRef) {
  const d = data;
  const isBike = dealer.financeType === 'bike';

  // Bank account is sent whenever a branch code is supplied (bike flow AND the
  // standalone vehicle application). Edith AccountType: CHEQUE / SAVINGS /
  // TRANSMISSION (CREDIT CARD needs CreditCardType and no branch code — not supported here).
  const bankAccountsXml = d.bankBranchCode ? `
        <tem:BankAccounts>
          <tem:BankAccount>
            ${d.bankAccountNumber ? `<tem:AccountNumber>${esc(d.bankAccountNumber)}</tem:AccountNumber>` : ''}
            ${d.accountType      ? `<tem:AccountType>${esc(d.accountType.toUpperCase())}</tem:AccountType>` : ''}
            <tem:AccountHolderName>${esc((d.accountHolderName || ((d.firstName || "") + " " + (d.lastName || ""))).trim().slice(0, 100))}</tem:AccountHolderName>
            <tem:BankBranchCode>${esc(d.bankBranchCode)}</tem:BankBranchCode>
            <tem:PrimaryAccountInd>-1</tem:PrimaryAccountInd>
          </tem:BankAccount>
        </tem:BankAccounts>` : '';

  const productsXml = isBike ? `
      <tem:Products>
        <tem:Product>
          <tem:ProductOptionId>${YONDA_SERVICE_FEE.productOptionId}</tem:ProductOptionId>
          <tem:Price>${YONDA_SERVICE_FEE.price}</tem:Price>
          <tem:SalesReferenceNumber>${esc(salesRef)}</tem:SalesReferenceNumber>
        </tem:Product>
      </tem:Products>` : '';

  // Work telephone code/number, per Edith Policy Webservices v312.19 (Person
  // object): WorkTelephoneCode must be numeric only, 3-4 digits, starting
  // with 0 (e.g. "011"); WorkTelephoneNumber must be numeric only, 7 digits
  // (e.g. "4470652"). Stripped here the same way mobile numbers are
  // stripped before being sent, so formatted input like "(011) 447-0652"
  // doesn't get silently ignored/errored by Edith's validation.
  const workTelCodeDigits = d.workTelephoneCode ? stripNonDigits(d.workTelephoneCode) : '';
  const workTelNumberDigits = d.workTelephoneNumber ? stripNonDigits(d.workTelephoneNumber) : '';

  // Edith nulls BondRentPayments / MunicipalPayments when ResidentialStatus is OWNER BOND FREE.
  const isOwnerFree = String(d.residentialStatus || '').toUpperCase() === 'OWNER BOND FREE';
  // LoanRepayments: applicant-entered value (standalone app) wins; otherwise the
  // Seriti bureau figure (widget flow). Never both — that would double count.
  const loanRepayments = Number(d.loanRepayments) > 0 ? d.loanRepayments : d.bureauExpenses;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:CreatePolicy>
      <tem:Credentials>
        <tem:CompanyCode>${companyCode}</tem:CompanyCode>
        <tem:CompanyPassword>${companyPass}</tem:CompanyPassword>
      </tem:Credentials>
      <tem:Policy>
        <tem:BranchCode>${dealer.branchCode}</tem:BranchCode>
        <tem:SalesReferenceNumber>${salesRef}</tem:SalesReferenceNumber>
        <tem:SalesSystem>E-fficient Widget</tem:SalesSystem>
        <tem:TransactionType>VEHICLE SALE</tem:TransactionType>
        <tem:Category>PRIVATE</tem:Category>${bankAccountsXml}
        ${d.vehicleMake    ? `<tem:Manufacturer>${esc(d.vehicleMake)}</tem:Manufacturer>` : ''}
        ${d.vehicleModel   ? `<tem:Model>${esc(d.vehicleModel)}</tem:Model>` : ''}
        ${d.vehicleMm      ? `<tem:VehicleCode>${esc(d.vehicleMm)}</tem:VehicleCode>` : ''}
        ${(d.vehicleMake || d.vehicleModel) ? `<tem:VehicleDescription>${esc([d.vehicleMake, d.vehicleModel].filter(Boolean).join(' '))}</tem:VehicleDescription>` : ''}
        <tem:NewUsed>${d.vehicleCondition ? esc(d.vehicleCondition.toUpperCase()) : 'USED'}</tem:NewUsed>
        ${d.stockNumber ? `<tem:StockNumber>${esc(d.stockNumber)}</tem:StockNumber>` : ''}
        ${d.vehicleColour ? `<tem:Colour>${esc(d.vehicleColour)}</tem:Colour>` : ''}
        ${d.odometerReading != null ? `<tem:OdometerReading>${d.odometerReading}</tem:OdometerReading>` : ''}
        ${d.chassisVinNumber ? `<tem:ChassisVINNumber>${esc(d.chassisVinNumber)}</tem:ChassisVINNumber>` : ''}
        ${/* Confirmed against Edith Policy Webservices v312.19: RetailPrice
             is a Policy-level field ("the listed price of the vehicle"),
             sibling to Manufacturer/Model/NewUsed — not nested under Client
             or FinanceApplication. Edith has no separate "selling price"
             field; Net Selling Price is RetailPrice minus Discount/
             FleetAssist/OtherIncome/Rebate, none of which this flow uses,
             so RetailPrice doubles as selling price here. */ ''}
        ${d.retailPrice ? `<tem:RetailPrice>${Number(d.retailPrice).toFixed(2)}</tem:RetailPrice>` : ''}
        ${d.spouseFirstName && (d.maritalStatus?.toUpperCase() === 'MARRIED' || d.applicationType === 'spouse') ? `
        <tem:Spouse>
          ${d.spouseTitle     ? `<tem:Title>${esc(String(d.spouseTitle).toUpperCase())}</tem:Title>` : ''}
          ${d.spouseFirstName ? `<tem:FirstName>${esc(d.spouseFirstName)}</tem:FirstName>` : ''}
          ${d.spouseLastName  ? `<tem:LastName>${esc(d.spouseLastName)}</tem:LastName>` : ''}
          <tem:IDType>${esc(d.spouseIdType || 'RSA ID')}</tem:IDType>
          ${d.spouseIdNumber  ? `<tem:IDNumber>${esc(d.spouseIdNumber)}</tem:IDNumber>` : ''}
          ${d.spouseGender    ? `<tem:Gender>${esc(d.spouseGender)}</tem:Gender>` : ''}
          ${d.spouseTaxNumber ? `<tem:TaxRegisteredInd>-1</tem:TaxRegisteredInd><tem:TaxNumber>${esc(String(d.spouseTaxNumber).slice(0, 20))}</tem:TaxNumber>` : ''}
          ${d.spouseEmploymentType ? `<tem:EmploymentType>${esc(d.spouseEmploymentType)}</tem:EmploymentType>` : ''}
          ${d.spouseEmployerName ? `<tem:EmployerName>${esc(d.spouseEmployerName)}</tem:EmployerName>` : ''}
          ${d.spouseOccupation ? `<tem:Occupation>${esc(d.spouseOccupation)}</tem:Occupation>` : ''}
          ${d.spouseEmploymentStartDate ? `<tem:CurrentEmploymentStartDate>${esc(d.spouseEmploymentStartDate)}</tem:CurrentEmploymentStartDate>` : ''}
          ${d.spouseSalaryDay ? `<tem:SalaryDay>${Number(d.spouseSalaryDay)}</tem:SalaryDay>` : ''}
          ${d.spouseBasicSalary ? `<tem:BasicSalary>${Number(d.spouseBasicSalary).toFixed(2)}</tem:BasicSalary>` : ''}
          ${d.spouseNettSalary ? `<tem:NettSalary>${Number(d.spouseNettSalary).toFixed(2)}</tem:NettSalary>` : ''}
          ${d.spouseExpenses ? SPOUSE_EXPENSE_TAGS.map((t) => moneyTag(t, d.spouseExpenses[t])).join('\n          ') : ''}
        </tem:Spouse>` : ''}
        ${d.nextOfKinFirstName ? `
        <tem:RelativeRelation>DISTANT</tem:RelativeRelation>
        <tem:Relative>
          ${d.nextOfKinFirstName ? `<tem:FirstName>${esc(d.nextOfKinFirstName)}</tem:FirstName>` : ''}
          ${d.nextOfKinLastName  ? `<tem:LastName>${esc(d.nextOfKinLastName)}</tem:LastName>` : ''}
          ${d.nextOfKinMobile    ? `<tem:MobileNumber>${esc(normaliseMobile(d.nextOfKinMobile))}</tem:MobileNumber>` : ''}
          ${d.nextOfKinEmail     ? `<tem:EmailAddress>${esc(String(d.nextOfKinEmail).slice(0, 100))}</tem:EmailAddress>` : ''}
        </tem:Relative>` : ''}
       <tem:Client>
          ${d.title         ? `<tem:Title>${esc(d.title.toUpperCase())}</tem:Title>` : ''}
          ${d.firstName     ? `<tem:FirstName>${esc(d.firstName)}</tem:FirstName>` : ''}
          <tem:LastName>${esc(d.lastName)}</tem:LastName>
          ${d.mobileNumber  ? `<tem:MobileNumber>${esc(normaliseMobile(d.mobileNumber))}</tem:MobileNumber>` : ''}
          ${d.emailAddress  ? `<tem:EmailAddress>${esc(d.emailAddress)}</tem:EmailAddress>` : ''}
          ${d.idNumber      ? `<tem:IDType>${esc(d.idType || 'RSA ID')}</tem:IDType><tem:IDNumber>${d.idNumber}</tem:IDNumber>` : '<tem:IDType>FOREIGN NATIONAL</tem:IDType>'}
          ${d.gender        ? `<tem:Gender>${esc(d.gender.toUpperCase())}</tem:Gender>` : ''}
          ${d.birthCountry ? `<tem:BirthCountry>${esc(d.birthCountry)}</tem:BirthCountry>` : ''}
          ${d.ethnicGroup ? `<tem:EthnicGroup>${esc(String(d.ethnicGroup).toUpperCase())}</tem:EthnicGroup>` : ''}
          ${d.educationLevel ? `<tem:EducationLevel>${esc(d.educationLevel)}</tem:EducationLevel>` : ''}
          ${d.taxNumber ? `<tem:TaxRegisteredInd>-1</tem:TaxRegisteredInd><tem:TaxNumber>${esc(String(d.taxNumber).slice(0, 20))}</tem:TaxNumber>` : ''}
          ${d.residenceCountry ? `<tem:ResidenceCountry>${esc(d.residenceCountry)}</tem:ResidenceCountry>` : ''}
          ${d.maritalStatus ? `<tem:MaritalStatus>${esc(d.maritalStatus)}</tem:MaritalStatus>` : ''}
          ${d.marriageType  ? `<tem:MarriageType>${esc(d.marriageType)}</tem:MarriageType>` : ''}
          ${d.marriageDate  ? `<tem:MarriageDate>${esc(d.marriageDate)}</tem:MarriageDate>` : ''}
          ${d.homeLanguage ? `<tem:HomeLanguage>${esc(d.homeLanguage)}</tem:HomeLanguage>` : ''}
          ${d.correspondenceLanguage ? `<tem:CorrespondenceLanguage>${esc(d.correspondenceLanguage)}</tem:CorrespondenceLanguage>` : ''}
          ${d.address1 ? `
          <tem:PhysicalAddress>
            <tem:Address1>${esc(d.address1)}</tem:Address1>
            ${d.suburb   ? `<tem:Suburb>${esc(d.suburb)}</tem:Suburb>` : ''}
            ${d.city     ? `<tem:City>${esc(d.city)}</tem:City>` : ''}
            ${d.postCode ? `<tem:PostCode>${esc(d.postCode)}</tem:PostCode>` : ''}
            <tem:Country>SOUTH AFRICA</tem:Country>
          </tem:PhysicalAddress>
          ${d.residentialStatus    ? `<tem:ResidentialStatus>${esc(d.residentialStatus)}</tem:ResidentialStatus>` : ''}
          ${d.physicalAddressDate  ? `<tem:PhysicalAddressDate>${esc(d.physicalAddressDate)}</tem:PhysicalAddressDate>` : ''}` : ''}
          ${d.employmentType ? `<tem:EmploymentType>${esc(d.employmentType)}</tem:EmploymentType>` : ''}
          ${d.employerName   ? `<tem:EmployerName>${esc(d.employerName)}</tem:EmployerName>` : ''}
          ${d.occupation     ? `<tem:Occupation>${esc(d.occupation)}</tem:Occupation>` : ''}
          ${d.occupationLevel ? `<tem:OccupationLevel>${esc(d.occupationLevel)}</tem:OccupationLevel>` : ''}
          ${d.industry       ? `<tem:Industry>${esc(d.industry)}</tem:Industry>` : ''}
          ${workTelCodeDigits   ? `<tem:WorkTelephoneCode>${esc(workTelCodeDigits)}</tem:WorkTelephoneCode>` : ''}
          ${workTelNumberDigits ? `<tem:WorkTelephoneNumber>${esc(workTelNumberDigits)}</tem:WorkTelephoneNumber>` : ''}
          ${d.currentEmploymentStartDate ? `<tem:CurrentEmploymentStartDate>${esc(d.currentEmploymentStartDate)}</tem:CurrentEmploymentStartDate>` : ''}
          ${d.workAddress1 ? `
          <tem:EmploymentAddress>
            <tem:Address1>${esc(d.workAddress1)}</tem:Address1>
            ${d.workSuburb   ? `<tem:Suburb>${esc(d.workSuburb)}</tem:Suburb>` : ''}
            ${d.workCity     ? `<tem:City>${esc(d.workCity)}</tem:City>` : ''}
            ${d.workPostCode ? `<tem:PostCode>${esc(d.workPostCode)}</tem:PostCode>` : ''}
            <tem:Country>SOUTH AFRICA</tem:Country>
          </tem:EmploymentAddress>` : ''}
          ${d.salaryDay && Number(d.salaryDay) >= 1 && Number(d.salaryDay) <= 31 ? `<tem:SalaryDay>${Number(d.salaryDay)}</tem:SalaryDay>` : ''}
          ${d.basicSalary    ? `<tem:BasicSalary>${Number(d.basicSalary).toFixed(2)}</tem:BasicSalary>` : ''}
          ${d.nettSalary     ? `<tem:NettSalary>${Number(d.nettSalary).toFixed(2)}</tem:NettSalary>` : ''}
          ${moneyTag('LoanRepayments', loanRepayments)}
          ${moneyTag('VehicleRepayments', d.vehicleRepayments)}
          ${moneyTag('InsurancePayments', d.insurancePayments)}
          ${isOwnerFree ? '' : moneyTag('MunicipalPayments', d.municipalPayments)}
          ${isOwnerFree ? '' : moneyTag('BondRentPayments', d.monthlyRentExpense)}
          ${moneyTag('CreditCardPayments', d.creditCardPayments)}
          ${moneyTag('FurnitureAccountPayments', d.furnitureAccountPayments)}
          ${moneyTag('ClothingAccountPayments', d.clothingAccountPayments)}
          ${moneyTag('OverdraftPayments', d.overdraftPayments)}
          ${moneyTag('TelephonePayments', d.telephonePayments)}
          ${moneyTag('TransportCosts', d.transportCosts)}
          ${moneyTag('FoodEntertainmentCosts', d.monthlyFoodExpense)}
          ${moneyTag('EducationCosts', d.educationCosts)}
          ${moneyTag('ChildMaintenance', d.childMaintenance)}
          ${moneyTag('HouseHoldExpenses', d.householdExpenses)}
          ${moneyTag('OtherPayments', d.monthlyOtherExpense)}
          <tem:FundsSource>SALARY</tem:FundsSource>
          ${moneyTag('SecurityPayments', d.securityPayments)}
          ${d.otherPaymentsDescription ? `<tem:OtherPaymentsDescription>${esc(String(d.otherPaymentsDescription).slice(0, 100))}</tem:OtherPaymentsDescription>` : ''}
          <tem:FinanceApplication>
            <tem:CompanyCode>${companyCode}</tem:CompanyCode>
            ${d.depositAmount ? `<tem:DepositValue>${Number(d.depositAmount).toFixed(2)}</tem:DepositValue>` : ''}
            <tem:AgreementType>INSTALMENT SALE</tem:AgreementType>
            <tem:PaymentMethod>DEBIT ORDER</tem:PaymentMethod>
          </tem:FinanceApplication>
          <tem:Consents>
            <tem:DataAttestationInd>${d.dataAttestation ? '1' : '0'}</tem:DataAttestationInd>
            <tem:TelesalesMarketingConsentInd>${d.marketingConsent ? '1' : '0'}</tem:TelesalesMarketingConsentInd>
            <tem:EmailMarketingConsentInd>${d.marketingConsent ? '1' : '0'}</tem:EmailMarketingConsentInd>
            <tem:SMSMarketingConsentInd>${d.marketingConsent ? '1' : '0'}</tem:SMSMarketingConsentInd>
            <tem:IdxConsentInd>${d.financialAccessConsent ? '1' : '0'}</tem:IdxConsentInd>
            <tem:IvxConsentInd>${d.financialAccessConsent ? '1' : '0'}</tem:IvxConsentInd>
          </tem:Consents>
        </tem:Client>
      </tem:Policy>${productsXml}
    </tem:CreatePolicy>
  </soap:Body>
</soap:Envelope>`;
}

// ── Helpers ───────────────────────────────────────────────────

/** Money (2dp) element — omitted when blank, zero or not a positive number. */
function moneyTag(tag, value) {
  const n = Number(value);
  return n > 0 ? `<tem:${tag}>${n.toFixed(2)}</tem:${tag}>` : '';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Normalises a mobile number to 10-digit SA format starting with 0.
 * Handles: +27821234567 → 0821234567, 27821234567 → 0821234567
 */
function normaliseMobile(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) return '0' + digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return digits; // return as-is and let Edith validate
}

/**
 * Strips all non-digit characters from a value. Used for WorkTelephoneCode
 * and WorkTelephoneNumber, which Edith requires as numeric-only (see Person
 * object, Edith Policy Webservices v312.19) but which may arrive from the
 * frontend formatted (e.g. "(011) 447-0652" or "011-447-0652").
 * No country-code handling here (unlike normaliseMobile) since work
 * telephone numbers are always local SA numbers, not mobile numbers that
 * might arrive with a +27 prefix.
 */
function stripNonDigits(value) {
  return String(value).replace(/\D/g, '');
}

function generateSalesRef(branchCode) {
  return `${branchCode}-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseEdithXMLResponse(xml) {
  const getTag = (tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, 'i'));
    return match ? match[1].trim() : null;
  };

  const responseStatusMatch = xml.match(/<response[^>]*>[\s\S]*<StatusCode[^>]*>([^<]*)<\/StatusCode>/i);
  const statusCode = parseInt(responseStatusMatch?.[1] || '100');

  const policyNumber = getTag('PolicyNumber');
  const systemMessage = getTag('Message');
  const errors = [];

  const errorMatches = xml.matchAll(/<InputError[^>]*>([\s\S]*?)<\/InputError>/gi);
  for (const m of errorMatches) {
    const fieldMatch = m[1].match(/<FieldName[^>]*>([^<]*)<\/FieldName>/i);
    const codeMatch  = m[1].match(/<FieldStatusCode[^>]*>([^<]*)<\/FieldStatusCode>/i);
    const msgMatch   = m[1].match(/<Description[^>]*>([^<]*)<\/Description>/i);
    if (fieldMatch) {
      errors.push({
        FieldName:    fieldMatch[1].trim(),
        StatusCode:   parseInt(codeMatch?.[1] || '300'),
        ErrorMessage: msgMatch?.[1]?.trim() || '',
      });
    }
  }
  return { statusCode, policyNumber, systemMessage, errors };
}

// ── Structured logging ────────────────────────────────────────

function logError(type, data, env, context = {}) {
  console.error(JSON.stringify({
    level: 'error',
    type,
    ...context,
    data,
    ts: new Date().toISOString(),
    env: env.WORKER_ENV,
  }));
}

function logWarning(type, data, env, context = {}) {
  console.warn(JSON.stringify({
    level: 'warn',
    type,
    ...context,
    data,
    ts: new Date().toISOString(),
    env: env.WORKER_ENV,
  }));
}