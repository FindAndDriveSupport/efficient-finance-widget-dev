/**
 * submitDocuments.js — Submit supporting documents to Edith
 * POST /api/policy/documents
 */

const ALLOWED_EXTENSIONS = new Set([
  'bmp','doc','docx','gif','jpeg','jpg','pdf','png','rtf','tif','tiff','txt','xls','xlsx','zip',
]);

const ALLOWED_CATEGORIES = new Set([
  'BANK STATEMENT','COMPANY REGISTRATION DOCUMENTS','COPY OF ORIGINAL NATIS DOCUMENT',
  'COSTING SCHEDULE','CPA DOCUMENTS','DEA CONSENT FORM','DEBT PROTECTION',
  'DECLARATION OF HEALTH','DELIVERY RECEIPT','DRIVERS LICENCE','EMAIL CORRESPONDENCE',
  'EMPLOYMENT CONTRACT','FINANCE APPLICATION','FINANCE APPROVAL','FINANCE CONTRACT',
  'FINANCIAL STATEMENTS','HPI','ID DOCUMENT','ID DOCUMENT - CLIENT','ID DOCUMENT - SPOUSE','IGF INVOICE','INSPECTION FORM',
  'INSURANCE CONFIRMATION','INSURANCE QUOTE','INVOICE','MARRIAGE CERTIFICATE',
  'NATIS DOCUMENT','OFFER TO PURCHASE','OPERATING LICENCE','ORDER FORM','OTHER DOCUMENT',
  'PASSPORT','PRODUCT CANCELLATION FORM','PRODUCT SCHEDULE','PROOF OF PAYMENT',
  'PROOF OF RESIDENCE','PROXY','RECORD OF ADVICE','RECORD OF TRANSACTION',
  'REGISTRATION CERTIFICATE','REMITTANCE ADVICE','RESIDENCE PERMIT',
  'ROADWORTHY CERTIFICATE','ROUTE FORM','SALARY SLIP','SARS','SHORTFALL',
  'SOURCE OF FUND DECLARATION','TAXI ASSOCIATION LETTER','TRACKING CERTIFICATE',
  'TRADE-IN DOCUMENTS','TRANSACTION SCHEDULE','VALIDATION DOCUMENTS',
  'VEHICLE HEALTH CHECK','VOICE LOG',
]);

export async function handleSubmitDocuments(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin, env); }

  const { policyNumber, salesRef, documents } = body;

  if (!policyNumber) {
    console.error(JSON.stringify({ level: 'error', type: 'submit_docs_validation', reason: 'missing_policyNumber', dealerKey: dealerConfig?.key, ts: new Date().toISOString() }));
    return jsonResponse({ error: 'Missing policyNumber' }, 400, origin, env);
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    console.error(JSON.stringify({ level: 'error', type: 'submit_docs_validation', reason: 'no_documents', dealerKey: dealerConfig?.key, policyNumber, ts: new Date().toISOString() }));
    return jsonResponse({ error: 'No documents provided' }, 400, origin, env);
  }

  // Validate each document
  for (const doc of documents) {
    if (!doc.base64) {
      console.error(JSON.stringify({ level: 'error', type: 'submit_docs_validation', reason: 'missing_base64', category: doc.category, dealerKey: dealerConfig?.key, policyNumber, ts: new Date().toISOString() }));
      return jsonResponse({ error: 'Each document requires base64 content' }, 400, origin, env);
    }
    const ext = (doc.fileExtension || '').toLowerCase().replace(/^\./, '');
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      console.error(JSON.stringify({ level: 'error', type: 'submit_docs_validation', reason: 'invalid_extension', ext, dealerKey: dealerConfig?.key, policyNumber, ts: new Date().toISOString() }));
      return jsonResponse({ error: `Invalid file extension: ${doc.fileExtension}` }, 400, origin, env);
    }
    const category = (doc.category || '').toUpperCase();
    if (!ALLOWED_CATEGORIES.has(category)) {
      console.error(JSON.stringify({ level: 'error', type: 'submit_docs_validation', reason: 'invalid_category', category, dealerKey: dealerConfig?.key, policyNumber, ts: new Date().toISOString() }));
      return jsonResponse({ error: `Invalid document category: ${doc.category}` }, 400, origin, env);
    }
  }

  // Select Edith credentials and WSDL URL based on dealer's edithEnv
  const isProd = dealerConfig?.edithEnv === 'prod';
  const companyCode = isProd ? env.EDITH_COMPANY_CODE_PROD : env.EDITH_COMPANY_CODE;
  const companyPass = isProd ? env.EDITH_COMPANY_PASS_PROD : env.EDITH_COMPANY_PASS;
  const wsdlUrl = isProd ? env.EDITH_WSDL_URL_PROD : env.EDITH_WSDL_URL;

  const xml = buildSubmitDocumentsXML(documents, companyCode, companyPass, policyNumber, dealerConfig?.branchCode, salesRef);

  console.log(JSON.stringify({
    level: 'info',
    type: 'edith_submit_documents_request',
    policyNumber,
    dealerKey: dealerConfig?.key,
    edithEnv: dealerConfig?.edithEnv || 'dev',
    documentCount: documents.length,
    categories: documents.map(d => d.category),
    ts: new Date().toISOString(),
  }));

  let edithText;
  try {
    const res = await fetch(wsdlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ws.edith.co.za/EdithServices/PolicyServicesV300/SubmitDocuments',
      },
      body: xml,
    });
    edithText = await res.text();
    console.log(JSON.stringify({
      level: 'info',
      type: 'edith_submit_documents_response',
      policyNumber,
      status: res.status,
      body: edithText,
      ts: new Date().toISOString(),
    }));
  } catch (err) {
    logError('edith_documents_network_error', err, env, { policyNumber });
    return jsonResponse({
      error: 'Could not connect to the finance system. Please try again.',
    }, 502, origin, env);
  }

  const parsed = parseSubmitDocumentsResponse(edithText);

  if (parsed.statusCode !== 100) {
    logError('edith_documents_error', parsed, env, { policyNumber });
    return jsonResponse({
      success: false,
      error: parsed.message || 'Document submission failed.',
      code: parsed.statusCode,
    }, 422, origin, env);
  }

  return jsonResponse({
    success: true,
    policyNumber,
    message: parsed.message || 'Documents submitted successfully',
  }, 200, origin, env);
}

// ── Edith XML Builder ────────────────────────────────────────────────────

function buildSubmitDocumentsXML(documents, companyCode, companyPass, policyNumber, branchCode, salesRef) {
  const docsXml = documents.map((doc) => {
    const guid = crypto.randomUUID();
    const ext = (doc.fileExtension || '').toLowerCase().replace(/^\./, '');
    const category = (doc.category || '').toUpperCase();
    return `
      <tem:Document>
        <tem:Base64EncodedDocument>${doc.base64}</tem:Base64EncodedDocument>
        <tem:DocumentCategory>${esc(category)}</tem:DocumentCategory>
        ${doc.description ? `<tem:DocumentDescription>${esc(doc.description.slice(0, 500))}</tem:DocumentDescription>` : ''}
        <tem:DocumentGUID>${guid}</tem:DocumentGUID>
        <tem:FileExtension>${esc(ext)}</tem:FileExtension>
        <tem:SignInd>false</tem:SignInd>
      </tem:Document>`;
  }).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://ws.edith.co.za/EdithServices/PolicyServicesV300">
  <soap:Body>
    <tem:SubmitDocuments>
      <tem:Credentials>
        <tem:CompanyCode>${companyCode}</tem:CompanyCode>
        <tem:CompanyPassword>${companyPass}</tem:CompanyPassword>
      </tem:Credentials>
      ${salesRef ? `<tem:SalesReferenceNumber>${esc(salesRef)}</tem:SalesReferenceNumber>` : ''}
      ${branchCode ? `<tem:BranchCode>${esc(branchCode)}</tem:BranchCode>` : ''}
      <tem:PolicyNumber>${esc(policyNumber)}</tem:PolicyNumber>
      <tem:Documents>${docsXml}
      </tem:Documents>
    </tem:SubmitDocuments>
  </soap:Body>
</soap:Envelope>`;
}

// ── Response Parser ──────────────────────────────────────────────────────

function parseSubmitDocumentsResponse(xml) {
  const getTag = (tag) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]*)<`, 'i'));
    return match ? match[1].trim() : null;
  };
  const statusCode = parseInt(getTag('StatusCode') || getTag('ReturnCode') || '100');
  const message = getTag('Message');
  return { statusCode, message };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function logError(type, data, env, context = {}) {
  console.error(JSON.stringify({
    level: 'error',
    type,
    ...context,
    data: data instanceof Error ? data.message : data,
    ts: new Date().toISOString(),
    env: env.WORKER_ENV,
  }));
}
