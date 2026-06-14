/**
 * edithErrors.js (Worker-compatible — no React imports)
 * Copied from edithErrors.js upload and adapted for Cloudflare Worker context.
 *
 * Maps Edith FieldName + StatusCode → user-facing messages with severity.
 */

export const STATUS_CODES = {
  100: { label: 'Success',                       severity: 'success' },
  200: { label: 'Success (some fields ignored)', severity: 'warning' },
  300: { label: 'Data failure',                  severity: 'error'   },
  400: { label: 'Authentication failure',        severity: 'error'   },
  410: { label: 'Authorisation failure',         severity: 'error'   },
  420: { label: 'Not authorised to view',        severity: 'error'   },
  500: { label: 'System failure',                severity: 'error'   },
};

export const SYSTEM_MESSAGES = {
  400: {
    title: 'We could not verify your application',
    message: 'There was a problem connecting to our finance system. This is not caused by your details.',
    action: 'Please contact the dealership and quote error code 400. They will be able to resubmit your application.',
    severity: 'error',
    internal: 'CompanyCode or CompanyPassword invalid. Check Worker secrets.',
  },
  410: {
    title: 'Access not permitted',
    message: 'This dealership is not currently set up to submit applications through this system.',
    action: 'Please speak to a member of staff at the dealership to complete your application in person.',
    severity: 'error',
    internal: 'Source system does not have access to this web method.',
  },
  420: {
    title: 'Application not found',
    message: 'We were unable to retrieve your application. It may have already been submitted.',
    action: 'Please contact the dealership with your reference number to check the status of your application.',
    severity: 'error',
    internal: 'Not authorised to view this policy. Check CompanyCode access.',
  },
  500: {
    title: 'System temporarily unavailable',
    message: 'The finance system is currently unavailable. This is a temporary issue.',
    action: 'Please try again in a few minutes. If the problem continues, contact the dealership.',
    severity: 'error',
    internal: 'Edith system failure.',
  },
};

export const FIELD_ERRORS = {
  CompanyCode:    { title: 'Dealer system error', message: 'Could not connect using dealership credentials.', severity: 'error', field: null },
  CompanyPassword:{ title: 'Dealer system error', message: 'Could not authenticate with finance system.', severity: 'error', field: null },
  BranchCode:     { title: 'Branch not found', message: 'This dealership branch is not registered.', severity: 'error', field: null },
  FIUserName:     { title: 'Finance manager not found', message: 'Could not assign a finance manager.', severity: 'error', field: null },
  SalesReferenceNumber: { title: 'Application already exists', message: 'A reference with this number has already been submitted.', severity: 'error', field: null },
  LastName:       { title: 'Surname missing', message: 'Your surname is required to submit your application.', severity: 'error', field: 'lastName' },
  IDNumber:       { title: 'ID number invalid', message: 'The ID number does not appear to be valid, or does not match your date of birth and gender.', severity: 'error', field: 'idNumber' },
  BirthDate:      { title: 'Date of birth not saved', message: 'Your date of birth could not be confirmed from your ID number.', severity: 'warning', field: 'birthDate' },
  Gender:         { title: 'Gender not saved', message: 'Your gender could not be confirmed from your ID number.', severity: 'warning', field: 'gender' },
  Title:          { title: 'Title not recognised', message: 'Please select from: Mr, Mrs, Miss, Ms, Dr, Prof, Adv, Hon, Rev.', severity: 'warning', field: 'title' },
  MobileNumber:   { title: 'Mobile number invalid', message: 'Please enter your mobile number with 10 digits starting with 0 (e.g. 0821234567).', severity: 'warning', field: 'mobileNumber' },
  WorkTelephoneCode:   { title: 'Work telephone code invalid', message: 'Enter your work area code with 3-4 digits starting with 0 (e.g. 011).', severity: 'warning', field: 'workTelCode' },
  HomeTelephoneNumber: { title: 'Home number invalid', message: 'Please enter only your 7-digit home number without the area code.', severity: 'warning', field: 'homeTelNumber' },
};

/**
 * Parse an array of Edith error objects into user-facing messages.
 * @param {Array<{FieldName, StatusCode, ErrorMessage}>} errors
 * @returns {Array<{field, title, message, severity}>}
 */
export function parseEdithErrors(errors = []) {
  return errors.map(err => {
    const mapped = FIELD_ERRORS[err.FieldName];
    const statusInfo = STATUS_CODES[err.StatusCode] || { severity: 'error' };
    return {
      field:    mapped?.field || err.FieldName,
      title:    mapped?.title || `Error: ${err.FieldName}`,
      message:  mapped?.message || err.ErrorMessage || 'An unexpected error occurred.',
      action:   mapped?.action || 'Please review your details and try again.',
      severity: mapped?.severity || statusInfo.severity,
      internal: mapped?.internal || null,
    };
  });
}
