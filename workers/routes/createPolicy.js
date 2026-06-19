/**
 * createPolicy.js — Step 3: Submit Application → Edith CreatePolicy
 * POST /api/policy/create
 *
 * Calls Edith webservice CreatePolicy with full field mapping.
 * Uses edithErrors.js error classification for user-facing messages.
 * Logs all errors to Cloudflare structured logging for CI/CD observability.
 */

import { STATUS_CODES, SYSTEM_MESSAGES, FIELD_ERRORS, parseEdithErrors } from '../utils/edithErrors.js';

// YONDA Service Fee — defaults applied for financeType === 'bike'
const YONDA_SERVICE_FEE = {
  productOptionId: '9845',
  price: '2990.00', // R2,990 including VAT
};

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
  console.error('EDITH_WSDL_URL: ' + wsdlUrl + ' | isProd: ' + isProd);

  // Build Edith XML payload
  const salesRef = generateSalesRef(dealerConfig.branchCode);
  console.error("EDITH_PAYLOAD: " + JSON.stringify(body));
  const xml = buildEdithXML(body, companyCode, companyPass, dealerConfig, salesRef);
  console.error("EDITH_XML: " + xml);

  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_create_policy_request',
    salesRef,
    dealerKey: dealerConfig.key,
    branchCode: dealerConfig.branchCode,
    edithEnv: dealerConfig.edithEnv || 'dev',
    ts: new Date().toISOString(),
  }));

  let edithResponse;
  try {
    const res = await fetch(wsdlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ws.edith.co.za/EdithServices/PolicyServicesV300/CreatePolicy',
      },
      body: xml,
    });
    const text = await res.text();
    console.log(JSON.stringify({
      level: 'info',
      type: 'edith_create_policy_response',
      salesRef,
      status: res.status,
      body: text,
      ts: new Date().toISOString(),
    }));
    console.error("EDITH_RAW_RESPONSE: " + text);
    edithResponse = parseEdithXMLResponse(text);
    console.error("EDITH_PARSED: " + JSON.stringify(edithResponse));
  } catch (err) {
    logError('edith_network_error', err, env, { salesRef, dealerKey: dealerConfig.key });
    return jsonResponse({
      error: 'Could not connect to the finance system. Please try again.',
      code: 500,
    }, 502, origin, env);
  }

  // Handle system-level errors
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

  // Handle field-level errors
  if (edithResponse.errors && edithResponse.errors.length > 0) {
    const parsedErrors = parseEdithErrors(edithResponse.errors);
    const fatal = parsedErrors.filter(e => e.severity === 'error');
    const warnings = parsedErrors.filter(e => e.severity === 'warning');

    if (fatal.length > 0) {
      logError('edith_field_errors', fatal, env, { salesRef });
      return jsonResponse({
        success: false,
        errors: fatal,
        warnings,
        code: 300,
      }, 422, origin, env);
    }

    // Code 200 — success with warnings
    logWarning('edith_field_warnings', warnings, env, { salesRef });
    return jsonResponse({
      success: true,
      policyNumber: edithResponse.policyNumber,
      warnings,
      code: 200,
    }, 200, origin, env);
  }

  // Clean success — store policy event in D1 and return
  const policyNumber = edithResponse.policyNumber;

  // Write to D1 in background (non-blocking)
  if (env.DB && policyNumber && workerCtx) {
    workerCtx.waitUntil(
      env.DB.prepare(`
        INSERT INTO policy_events (dealer_key, policy_number, applicant_id, sales_ref, branch_code, finance_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        dealerConfig.key,
        policyNumber,
        body.applicantId || null,
        salesRef,
        dealerConfig.branchCode,
        dealerConfig.financeType || 'vehicle',
      )
      .run()
      .catch(err => console.error('D1 write failed:', err.message))
    );
  }

  return jsonResponse({
    success: true,
    policyNumber,
    salesRef,
    code: 100,
  }, 200, origin, env);
}

// ── Edith XML Builder ─────────────────────────────────────────

function buildEdithXML(data, companyCode, companyPass, dealer, salesRef) {
  const d = data;
  const isBike = dealer.financeType === 'bike';

  // ── Bank Accounts block (Policy-level, before Client) — bike only ──
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

  // ── Products array (top-level, sibling of Policy) — YONDA service fee ──
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
        ${d.estimatedApprovalAmount ? `<tem:RetailPrice>${d.estimatedApprovalAmount}</tem:RetailPrice>` : d.preQualTotal ? `<tem:RetailPrice>${d.preQualTotal}</tem:RetailPrice>` : ''}
        <tem:NewUsed>USED</tem:NewUsed>
        ${d.spouseFirstName && d.maritalStatus?.toUpperCase() === 'MARRIED' ? `
        <tem:Spouse>
          ${d.spouseFirstName ? `<tem:FirstName>${esc(d.spouseFirstName)}</tem:FirstName>` : ''}
          ${d.spouseLastName  ? `<tem:LastName>${esc(d.spouseLastName)}</tem:LastName>` : ''}
          ${d.spouseIdNumber  ? `<tem:IDNumber>${esc(d.spouseIdNumber)}</tem:IDNumber>` : ''}
        </tem:Spouse>` : ''}
        ${d.nextOfKinFirstName ? `
        <tem:RelativeRelation>DISTANT</tem:RelativeRelation>
        <tem:Relative>
          ${d.nextOfKinFirstName ? `<tem:FirstName>${esc(d.nextOfKinFirstName)}</tem:FirstName>` : ''}
          ${d.nextOfKinLastName  ? `<tem:LastName>${esc(d.nextOfKinLastName)}</tem:LastName>` : ''}
          ${d.nextOfKinMobile    ? `<tem:MobileNumber>${esc(d.nextOfKinMobile)}</tem:MobileNumber>` : ''}
        </tem:Relative>` : ''}
       <tem:Client>
          ${d.title         ? `<tem:Title>${esc(d.title.toUpperCase())}</tem:Title>` : ''}
          ${d.firstName     ? `<tem:FirstName>${esc(d.firstName)}</tem:FirstName>` : ''}
          <tem:LastName>${esc(d.lastName)}</tem:LastName>
          ${d.mobileNumber  ? `<tem:MobileNumber>${d.mobileNumber}</tem:MobileNumber>` : ''}
          ${d.emailAddress  ? `<tem:EmailAddress>${esc(d.emailAddress)}</tem:EmailAddress>` : ''}
          ${d.idNumber      ? `<tem:IDType>${esc(d.idType || 'RSA ID')}</tem:IDType><tem:IDNumber>${d.idNumber}</tem:IDNumber>` : '<tem:IDType>FOREIGN NATIONAL</tem:IDType>'}
          ${d.gender        ? `<tem:Gender>${esc(d.gender.toUpperCase())}</tem:Gender>` : ''}
          ${d.educationLevel ? `<tem:EducationLevel>${esc(d.educationLevel)}</tem:EducationLevel>` : ''}
          ${d.maritalStatus ? `<tem:MaritalStatus>${esc(d.maritalStatus)}</tem:MaritalStatus>` : ''}
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
          ${d.salaryDay      ? `<tem:SalaryDay>${d.salaryDay}</tem:SalaryDay>` : ''}
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

function generateSalesRef(branchCode) {
  return `${branchCode}-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

function parseEdithXMLResponse(xml) {
  const getTag = (tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, 'i'));
    return match ? match[1].trim() : null;
  };
  const statusCode = parseInt(getTag('StatusCode') || getTag('ReturnCode') || '100');
  const policyNumber = getTag('PolicyNumber');
  const errors = [];

  const errorMatches = xml.matchAll(/<Error[^>]*>([\s\S]*?)<\/Error>/gi);
  for (const m of errorMatches) {
    const fieldMatch = m[1].match(/<FieldName[^>]*>([^<]*)<\/FieldName>/i);
    const codeMatch  = m[1].match(/<StatusCode[^>]*>([^<]*)<\/StatusCode>/i);
    const msgMatch   = m[1].match(/<ErrorMessage[^>]*>([^<]*)<\/ErrorMessage>/i);
    if (fieldMatch) {
      errors.push({
        FieldName:    fieldMatch[1],
        StatusCode:   parseInt(codeMatch?.[1] || '300'),
        ErrorMessage: msgMatch?.[1] || '',
      });
    }
  }
  return { statusCode, policyNumber, errors };
}

// ── Structured logging (Cloudflare Workers) ───────────────────

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
