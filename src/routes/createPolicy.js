/**
 * createPolicy.js — Step 3: Submit Application → Edith CreatePolicy
 * POST /api/policy/create
 *
 * Calls Edith webservice CreatePolicy with full field mapping.
 * Uses edithErrors.js error classification for user-facing messages.
 * Logs all errors to Cloudflare structured logging for CI/CD observability.
 */

import { STATUS_CODES, SYSTEM_MESSAGES, FIELD_ERRORS, parseEdithErrors } from '../utils/edithErrors.js';

const EDITH_WSDL = 'https://webservices.seritisolutions.co.za/PolicyService/PolicyService.svc';

export async function handleCreatePolicy(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env); }

  // Build Edith XML payload
  const salesRef = generateSalesRef(dealerConfig.branchCode);
  const xml = buildEdithXML(body, env, dealerConfig, salesRef);

  let edithResponse;
  try {
    const res = await fetch(EDITH_WSDL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IPolicyService/CreatePolicy',
      },
      body: xml,
    });
    const text = await res.text();
    edithResponse = parseEdithXMLResponse(text);
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

  // Clean success
  return jsonResponse({
    success: true,
    policyNumber: edithResponse.policyNumber,
    salesRef,
    code: 100,
  }, 200, origin, env);
}

// ── Edith XML Builder ─────────────────────────────────────────
// Maps app form fields → Edith CreatePolicy SOAP request
// Reference: edith-createpolicy-data-mapping.html

function buildEdithXML(data, env, dealer, salesRef) {
  const d = data; // shorthand

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Body>
    <tem:CreatePolicy>
      <tem:policy>
        <tem:Credentials>
          <tem:CompanyCode>${env.EDITH_COMPANY_CODE}</tem:CompanyCode>
          <tem:CompanyPassword>${env.EDITH_COMPANY_PASS}</tem:CompanyPassword>
        </tem:Credentials>
        <tem:Policy>
          <tem:BranchCode>${dealer.branchCode}</tem:BranchCode>
          <tem:SalesReferenceNumber>${salesRef}</tem:SalesReferenceNumber>
          <tem:TransactionType>VEHICLE SALE</tem:TransactionType>
          <tem:Category>PRIVATE</tem:Category>
          ${d.vehicleMake    ? `<tem:Manufacturer>${d.vehicleMake}</tem:Manufacturer>` : ''}
          ${d.vehicleModel   ? `<tem:Model>${d.vehicleModel}</tem:Model>` : ''}
          ${d.vehicleMm      ? `<tem:VehicleCode>${d.vehicleMm}</tem:VehicleCode>` : ''}
          ${d.estimatedApprovalAmount ? `<tem:RetailPrice>${d.estimatedApprovalAmount}</tem:RetailPrice>` : ''}
          <tem:NewUsed>USED</tem:NewUsed>
          <tem:Client>
            ${d.title      ? `<tem:Title>${d.title.toUpperCase()}</tem:Title>` : ''}
            ${d.firstName  ? `<tem:FirstName>${esc(d.firstName)}</tem:FirstName>` : ''}
            <tem:LastName>${esc(d.lastName)}</tem:LastName>
            ${d.mobileNumber ? `<tem:MobileNumber>${d.mobileNumber}</tem:MobileNumber>` : ''}
            ${d.emailAddress ? `<tem:EmailAddress>${esc(d.emailAddress)}</tem:EmailAddress>` : ''}
            ${d.idNumber    ? `<tem:IDType>RSA ID</tem:IDType><tem:IDNumber>${d.idNumber}</tem:IDNumber>` : '<tem:IDType>FOREIGN NATIONAL</tem:IDType>'}
            ${d.gender      ? `<tem:Gender>${d.gender.toUpperCase()}</tem:Gender>` : ''}
            ${d.birthDate   ? `<tem:BirthDate>${d.birthDate}</tem:BirthDate>` : ''}
            ${d.educationLevel ? `<tem:EducationLevel>${d.educationLevel}</tem:EducationLevel>` : ''}
            ${d.maritalStatus ? `<tem:MaritalStatus>${d.maritalStatus}</tem:MaritalStatus>` : ''}
            ${d.address1 ? `
            <tem:ResidentialAddress>
              <tem:Address1>${esc(d.address1)}</tem:Address1>
              ${d.suburb   ? `<tem:Suburb>${esc(d.suburb)}</tem:Suburb>` : ''}
              ${d.city     ? `<tem:City>${esc(d.city)}</tem:City>` : ''}
              ${d.province ? `<tem:Province>${d.province}</tem:Province>` : ''}
              ${d.postCode ? `<tem:PostCode>${d.postCode}</tem:PostCode>` : ''}
              <tem:Country>${d.country || 'ZA'}</tem:Country>
              ${d.residentialStatus ? `<tem:ResidentialStatus>${d.residentialStatus}</tem:ResidentialStatus>` : ''}
            </tem:ResidentialAddress>` : ''}
            ${d.nextOfKinFirstName ? `
            <tem:Relative>
              <tem:FirstName>${esc(d.nextOfKinFirstName)}</tem:FirstName>
              <tem:LastName>${esc(d.nextOfKinLastName || '')}</tem:LastName>
              <tem:MobileNumber>${d.nextOfKinMobile || ''}</tem:MobileNumber>
              <tem:Relation>${d.nextOfKinRelation || 'OTHER'}</tem:Relation>
            </tem:Relative>` : ''}
            <tem:Employment>
              ${d.employmentType ? `<tem:EmploymentType>${d.employmentType}</tem:EmploymentType>` : ''}
              ${d.employerName   ? `<tem:EmployerName>${esc(d.employerName)}</tem:EmployerName>` : ''}
              ${d.industry       ? `<tem:Industry>${d.industry}</tem:Industry>` : ''}
              ${d.occupation     ? `<tem:Occupation>${d.occupation}</tem:Occupation>` : ''}
              ${d.occupationLevel ? `<tem:OccupationLevel>${d.occupationLevel}</tem:OccupationLevel>` : ''}
              ${d.currentEmploymentStartDate ? `<tem:CurrentEmploymentStartDate>${d.currentEmploymentStartDate}</tem:CurrentEmploymentStartDate>` : ''}
              ${d.workTelCode ? `
              <tem:WorkTelephoneCode>${d.workTelCode}</tem:WorkTelephoneCode>
              <tem:WorkTelephoneNumber>${d.workTelNumber}</tem:WorkTelephoneNumber>` : ''}
              ${d.salaryDay ? `<tem:SalaryDay>${d.salaryDay}</tem:SalaryDay>` : ''}
              ${d.basicSalary ? `<tem:BasicSalary>${d.basicSalary}</tem:BasicSalary>` : ''}
              ${d.nettSalary  ? `<tem:NettSalary>${d.nettSalary}</tem:NettSalary>` : ''}
            </tem:Employment>
            <tem:FinanceApplication>
              <tem:CompanyCode>${env.EDITH_COMPANY_CODE}</tem:CompanyCode>
              ${d.financeTerm ? `<tem:FinanceTerm>${d.financeTerm}</tem:FinanceTerm>` : ''}
              ${d.depositAmount ? `<tem:DepositValue>${d.depositAmount}</tem:DepositValue>` : ''}
              <tem:AgreementType>INSTALMENT SALE</tem:AgreementType>
              <tem:PaymentMethod>DEBIT ORDER</tem:PaymentMethod>
              ${d.paymentDay ? `<tem:PaymentDay>${d.paymentDay}</tem:PaymentDay>` : ''}
            </tem:FinanceApplication>
            <tem:Consents>
              <tem:DataAttestationInd>${d.dataAttestation ? 'true' : 'false'}</tem:DataAttestationInd>
              <tem:TelesalesMarketingConsentInd>${d.telesalesConsent ? 'true' : 'false'}</tem:TelesalesMarketingConsentInd>
              <tem:EmailMarketingConsentInd>${d.emailConsent ? 'true' : 'false'}</tem:EmailMarketingConsentInd>
              <tem:SMSMarketingConsentInd>${d.smsConsent ? 'true' : 'false'}</tem:SMSMarketingConsentInd>
              <tem:IdxConsentInd>${d.idxConsent ? 'true' : 'false'}</tem:IdxConsentInd>
              <tem:IvxConsentInd>${d.ivxConsent ? 'true' : 'false'}</tem:IvxConsentInd>
            </tem:Consents>
          </tem:Client>
        </tem:Policy>
      </tem:policy>
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
  // Basic XML parsing — extract key elements
  const getTag = (tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`));
    return match ? match[1].trim() : null;
  };
  const statusCode = parseInt(getTag('StatusCode') || getTag('ReturnCode') || '100');
  const policyNumber = getTag('PolicyNumber');
  const errors = [];

  // Extract field errors from SOAP response
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
