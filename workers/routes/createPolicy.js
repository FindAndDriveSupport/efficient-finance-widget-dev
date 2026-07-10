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
 * On any real success (clean or with warnings), fires a fire-and-forget
 * call to Seriti's applicant/{id}/complete endpoint to mark the lead as
 * fully converted. This never blocks or alters the user's response.
 */

import { SYSTEM_MESSAGES, parseEdithErrors } from '../utils/edithErrors.js';
import { completeApplicant } from './completeApplicant.js';

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
      basicSalary: body.basicSalary ? '✓' : null,
      nettSalary: body.nettSalary ? '✓' : null,
      depositAmount: body.depositAmount ? '✓' : null,
      address1: body.address1 ? '✓' : null,
      suburb: body.suburb || null,
      city: body.city || null,
      postCode: body.postCode || null,
      residentialStatus: body.residentialStatus || null,
      bankBranchCode: body.bankBranchCode || null,
      accountType: body.accountType || null,
      accountNumber: body.bankAccountNumber ? '✓' : null,
      nextOfKinFirst: body.nextOfKinFirstName ? '✓' : null,
      nextOfKinLast: body.nextOfKinLastName ? '✓' : null,
      nextOfKinMobile: body.nextOfKinMobile ? '✓' : null,
      dataAttestation: body.dataAttestation ? '✓' : null,
      financialAccessConsent: body.financialAccessConsent ? '✓' : null,
    },
    ts: new Date().toISOString(),
  }));

  // ── Fetch with retry (network failures only) ──────────────────
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

  // ── All retries exhausted — genuine network failure ───────────
  if (networkFailure) {
    const failureReason = `Network failure after ${RETRY_LIMIT} attempts — Edith unreachable`;
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

  const edithResponse = parseEdithXMLResponse(rawText);

  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_parsed',
    salesRef,
    statusCode: edithResponse.statusCode,
    policyNumber: edithResponse.policyNumber,
    errorCount: edithResponse.errors.length,
    ts: new Date().toISOString(),
  }));

  // ── Edith system-level error (500) ────────────────────────────
  if (edithResponse.statusCode === 500) {
    const failureReason = `Edith system error 500 — ${edithResponse.systemMessage || 'System failure'}`;
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
      code: 200,
    }, 200, origin, env);
  }

  // ── Clean success ─────────────────────────────────────────────
  const policyNumber = edithResponse.policyNumber;
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
    code: 100,
  }, 200, origin, env);
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

function writePolicyEvent({ env, workerCtx, dealerConfig, body, salesRef, policyNumber, status, retryCount }) {
  if (!env.DB || !workerCtx) return;
  const applicantName = [body.firstName, body.lastName].filter(Boolean).join(' ') || null;
  workerCtx.waitUntil(
    env.DB.prepare(`
      INSERT INTO policy_events (
        dealer_key, policy_number, applicant_id, sales_ref, branch_code, finance_type,
        status, applicant_name, applicant_mobile, applicant_email,
        estimated_amount, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  const bankAccountsXml = (isBike && d.bankBranchCode) ? `
        <tem:BankAccounts>
          <tem:BankAccount>
            ${d.bankAccountNumber ? `<tem:AccountNumber>${esc(d.bankAccountNumber)}</tem:AccountNumber>` : ''}
            ${d.accountType      ? `<tem:AccountType>${esc(d.accountType.toUpperCase())}</tem:AccountType>` : ''}
            <tem:AccountHolderName>${esc((d.firstName || "") + " " + (d.lastName || ""))}</tem:AccountHolderName>
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
        <tem:TransactionType>VEHICLE SALE</tem:TransactionType>
        <tem:Category>PRIVATE</tem:Category>${bankAccountsXml}
        ${d.vehicleMake    ? `<tem:Manufacturer>${esc(d.vehicleMake)}</tem:Manufacturer>` : ''}
        ${d.vehicleModel   ? `<tem:Model>${esc(d.vehicleModel)}</tem:Model>` : ''}
        ${d.vehicleMm      ? `<tem:VehicleCode>${esc(d.vehicleMm)}</tem:VehicleCode>` : ''}
        ${(d.vehicleMake || d.vehicleModel) ? `<tem:VehicleDescription>${esc([d.vehicleMake, d.vehicleModel].filter(Boolean).join(' '))}</tem:VehicleDescription>` : ''}
        ${(Number(d.estimatedApprovalAmount) > 0) ? `<tem:RetailPrice>${Number(d.estimatedApprovalAmount).toFixed(2)}</tem:RetailPrice>` : (d.idType !== 'RSA ID' && Number(d.preQualTotal) > 0) ? `<tem:RetailPrice>${Number(d.preQualTotal).toFixed(2)}</tem:RetailPrice>` : ''}
        <tem:NewUsed>USED</tem:NewUsed>
        ${d.spouseFirstName && d.maritalStatus?.toUpperCase() === 'MARRIED' ? `
        <tem:Spouse>
          ${d.spouseFirstName ? `<tem:FirstName>${esc(d.spouseFirstName)}</tem:FirstName>` : ''}
          ${d.spouseLastName  ? `<tem:LastName>${esc(d.spouseLastName)}</tem:LastName>` : ''}
          <tem:IDType>${esc(d.spouseIdType || 'RSA ID')}</tem:IDType>
          ${d.spouseIdNumber  ? `<tem:IDNumber>${esc(d.spouseIdNumber)}</tem:IDNumber>` : ''}
        </tem:Spouse>` : ''}
        ${d.nextOfKinFirstName ? `
        <tem:RelativeRelation>DISTANT</tem:RelativeRelation>
        <tem:Relative>
          ${d.nextOfKinFirstName ? `<tem:FirstName>${esc(d.nextOfKinFirstName)}</tem:FirstName>` : ''}
          ${d.nextOfKinLastName  ? `<tem:LastName>${esc(d.nextOfKinLastName)}</tem:LastName>` : ''}
          ${d.nextOfKinMobile    ? `<tem:MobileNumber>${esc(normaliseMobile(d.nextOfKinMobile))}</tem:MobileNumber>` : ''}
        </tem:Relative>` : ''}
       <tem:Client>
          ${d.title         ? `<tem:Title>${esc(d.title.toUpperCase())}</tem:Title>` : ''}
          ${d.firstName     ? `<tem:FirstName>${esc(d.firstName)}</tem:FirstName>` : ''}
          <tem:LastName>${esc(d.lastName)}</tem:LastName>
          ${d.mobileNumber  ? `<tem:MobileNumber>${esc(normaliseMobile(d.mobileNumber))}</tem:MobileNumber>` : ''}
          ${d.emailAddress  ? `<tem:EmailAddress>${esc(d.emailAddress)}</tem:EmailAddress>` : ''}
          ${d.idNumber      ? `<tem:IDType>${esc(d.idType || 'RSA ID')}</tem:IDType><tem:IDNumber>${d.idNumber}</tem:IDNumber>` : '<tem:IDType>FOREIGN NATIONAL</tem:IDType>'}
          ${d.gender        ? `<tem:Gender>${esc(d.gender.toUpperCase())}</tem:Gender>` : ''}
          ${d.educationLevel ? `<tem:EducationLevel>${esc(d.educationLevel)}</tem:EducationLevel>` : ''}
          ${d.maritalStatus ? `<tem:MaritalStatus>${esc(d.maritalStatus)}</tem:MaritalStatus>` : ''}
          ${d.marriageType  ? `<tem:MarriageType>${esc(d.marriageType)}</tem:MarriageType>` : ''}
          ${d.marriageDate  ? `<tem:MarriageDate>${esc(d.marriageDate)}</tem:MarriageDate>` : ''}
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
          ${d.currentEmploymentStartDate ? `<tem:CurrentEmploymentStartDate>${esc(d.currentEmploymentStartDate)}</tem:CurrentEmploymentStartDate>` : ''}
          ${d.salaryDay && Number(d.salaryDay) >= 1 && Number(d.salaryDay) <= 31 ? `<tem:SalaryDay>${Number(d.salaryDay)}</tem:SalaryDay>` : ''}
          ${d.basicSalary    ? `<tem:BasicSalary>${Number(d.basicSalary).toFixed(2)}</tem:BasicSalary>` : ''}
          ${d.nettSalary     ? `<tem:NettSalary>${Number(d.nettSalary).toFixed(2)}</tem:NettSalary>` : ''}
          ${d.bureauExpenses ? `<tem:LoanRepayments>${Number(d.bureauExpenses).toFixed(2)}</tem:LoanRepayments>` : ''}
          <tem:FundsSource>SALARY</tem:FundsSource>
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
