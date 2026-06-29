/**
 * edithErrors.js
 * 
 * User-facing error messages for Edith Policy Webservice responses.
 * Maps Edith FieldName + StatusCode combinations to plain-language messages
 * with actionable fix instructions for end-users.
 * 
 * Usage:
 *   import { getErrorMessage, parseEdithErrors } from './edithErrors'
 * 
 *   const errors = parseEdithErrors(edithResponse.Errors)
 *   // Returns array of { field, title, message, action, severity }
 */

// ─── Status Code Definitions ─────────────────────────────────────────────────

export const STATUS_CODES = {
  100: { label: 'Success',                    severity: 'success' },
  200: { label: 'Success (some fields ignored)', severity: 'warning' },
  300: { label: 'Data failure',               severity: 'error'   },
  400: { label: 'Authentication failure',     severity: 'error'   },
  410: { label: 'Authorisation failure',      severity: 'error'   },
  420: { label: 'Not authorised to view',     severity: 'error'   },
  500: { label: 'System failure',             severity: 'error'   },
}

// ─── Top-Level System Messages ────────────────────────────────────────────────

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
    internal: 'Source system does not have access to this web method. Contact Agatha Design.',
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
    internal: 'Edith system failure. Check service status at seritisolutions.co.za.',
  },
}

// ─── Field-Level Error Messages ───────────────────────────────────────────────
// Key: Edith FieldName (case as returned in response)
// Each entry includes user-facing content + internal note for developers

export const FIELD_ERRORS = {

  // ── Authentication & Setup ──────────────────────────────────────────────

  CompanyCode: {
    title: 'Dealer system error',
    message: 'We could not connect to the finance system using this dealership\'s credentials.',
    action: 'Please contact the dealership. This is a setup issue on our side, not with your details.',
    severity: 'error',
    field: null, // no form field — system issue
    internal: 'CompanyCode invalid or not set up. Check wrangler secrets.',
  },

  CompanyPassword: {
    title: 'Dealer system error',
    message: 'We could not authenticate with the finance system.',
    action: 'Please contact the dealership. This is a technical issue that does not affect your application.',
    severity: 'error',
    field: null,
    internal: 'CompanyPassword invalid. Rotate via Agatha Design.',
  },

  BranchCode: {
    title: 'Branch not found',
    message: 'This dealership branch is not registered in the finance system.',
    action: 'Please check you are using the correct dealership\'s application form, or speak to a staff member.',
    severity: 'error',
    field: null,
    internal: 'BranchCode not accessible by source system. Check onboarding setup.',
  },

  FIUserName: {
    title: 'Finance manager not found',
    message: 'We could not assign a finance manager to your application.',
    action: 'Please contact the dealership to have a finance manager assigned before resubmitting.',
    severity: 'error',
    field: null,
    internal: 'FIUserName cannot be resolved. Ensure branch has a Default Business Manager set in Edith.',
  },

  SalesReferenceNumber: {
    title: 'Application already submitted',
    message: 'An application with this reference number has already been submitted to the finance system.',
    action: 'Please contact the dealership with your reference number to check the status of your existing application.',
    severity: 'error',
    field: null,
    internal: 'SalesReferenceNumber + BranchCode already exists. Generate a new unique reference.',
  },

  // ── Personal Details ────────────────────────────────────────────────────

  LastName: {
    title: 'Surname is required',
    message: 'Your surname could not be verified. This is required to submit your application.',
    action: 'Please check that your surname is entered exactly as it appears on your ID document.',
    severity: 'error',
    field: 'lastName',
    internal: 'LastName missing from Client object.',
  },

  FirstName: {
    title: 'First name was not saved',
    message: 'Your first name could not be confirmed from the information provided.',
    action: 'Please ensure your first name matches exactly what appears on your ID document, including any middle names.',
    severity: 'warning',
    field: 'firstName',
    internal: 'FirstName ignored — check for special characters or length > 50.',
  },

  IDNumber: {
    title: 'ID number could not be verified',
    message: 'The ID number provided does not appear to be a valid South African ID number, or does not match your date of birth and gender.',
    action: 'Please check your ID number, date of birth and gender are correct and exactly match your ID document. All three must be consistent with each other.',
    severity: 'error',
    field: 'idNumber',
    internal: 'IDNumber failed Luhn check or DOB/Gender mismatch. Validate all three fields together.',
  },

  IDType: {
    title: 'ID type not recognised',
    message: 'The type of identity document selected is not recognised.',
    action: 'Please select either "South African ID", "Passport" or "Other ID" from the options provided.',
    severity: 'error',
    field: 'idType',
    internal: 'IDType must be [RSA ID], [PASSPORT], or [OTHER ID].',
  },

  BirthDate: {
    title: 'Date of birth was not saved',
    message: 'Your date of birth could not be confirmed. It must be consistent with your ID number and gender.',
    action: 'Please check your date of birth matches your ID number exactly. For South African IDs, the first 6 digits of your ID number represent your date of birth (YYMMDD).',
    severity: 'warning',
    field: 'birthDate',
    internal: 'BirthDate ignored — mismatch with IDNumber. Also check format is dd-mmm-yyyy.',
  },

  Gender: {
    title: 'Gender was not saved',
    message: 'Your gender could not be confirmed from your ID number.',
    action: 'Please check that your gender selection matches your South African ID number. Digits 7-10 of your ID number indicate gender (0000–4999 = Female, 5000–9999 = Male).',
    severity: 'warning',
    field: 'gender',
    internal: 'Gender ignored — mismatch with IDNumber digits 7-10.',
  },

  PassportIssueDate: {
    title: 'Passport issue date not saved',
    message: 'The passport issue date you provided was not in a recognised format.',
    action: 'Please enter your passport issue date in the format DD/MM/YYYY.',
    severity: 'warning',
    field: 'passportIssueDate',
    internal: 'PassportIssueDate format error. Must be dd-mmm-yyyy.',
  },

  PassportExpiryDate: {
    title: 'Passport expiry date not saved',
    message: 'The passport expiry date you provided was not in a recognised format.',
    action: 'Please enter your passport expiry date in the format DD/MM/YYYY.',
    severity: 'warning',
    field: 'passportExpiryDate',
    internal: 'PassportExpiryDate format error. Must be dd-mmm-yyyy.',
  },

  Title: {
    title: 'Title not recognised',
    message: 'The title you selected was not recognised by the system.',
    action: 'Please select a title from the available options (Mr, Mrs, Miss, Ms, Dr, Prof, Adv, Hon, Rev).',
    severity: 'warning',
    field: 'title',
    internal: 'Title must be one of [MR],[MRS],[MISS],[DR],[MS],[PROF],[ADV],[HON],[REV].',
  },

  // ── Contact Details ─────────────────────────────────────────────────────

  MobileNumber: {
    title: 'Mobile number is not valid',
    message: 'The mobile number provided is not in the correct format.',
    action: 'Please enter your South African mobile number with 10 digits starting with 0 (e.g. 0821234567). Do not include country codes like +27.',
    severity: 'warning',
    field: 'mobileNumber',
    internal: 'MobileNumber must be 10 digits starting with 0. Strip +27 prefix before sending.',
  },

  AlternativeMobileNumber: {
    title: 'Alternative mobile number is not valid',
    message: 'The alternative mobile number provided is not in the correct format.',
    action: 'Please enter a 10-digit South African mobile number starting with 0, or leave this field blank.',
    severity: 'warning',
    field: 'alternativeMobileNumber',
    internal: 'AlternativeMobileNumber must be 10 digits starting with 0.',
  },

  WorkTelephoneCode: {
    title: 'Work telephone area code is not valid',
    message: 'The work telephone area code provided is not recognised.',
    action: 'Please enter your work telephone area code with 3 or 4 digits starting with 0 (e.g. 011 or 021). Enter the area code and number in separate fields.',
    severity: 'warning',
    field: 'workTelephoneCode',
    internal: 'WorkTelephoneCode must be 3-4 numeric digits starting with 0.',
  },

  WorkTelephoneNumber: {
    title: 'Work telephone number is not valid',
    message: 'The work telephone number provided must be exactly 7 digits.',
    action: 'Please enter only the 7-digit telephone number without the area code (e.g. 4470652). Enter the area code separately.',
    severity: 'warning',
    field: 'workTelephoneNumber',
    internal: 'WorkTelephoneNumber must be exactly 7 digits.',
  },

  HomeTelephoneCode: {
    title: 'Home telephone area code is not valid',
    message: 'The home telephone area code must be exactly 3 digits starting with 0.',
    action: 'Please enter your home area code separately from your number (e.g. 011). If you do not have a home landline, you may leave this blank.',
    severity: 'warning',
    field: 'homeTelephoneCode',
    internal: 'HomeTelephoneCode must be exactly 3 digits starting with 0.',
  },

  HomeTelephoneNumber: {
    title: 'Home telephone number is not valid',
    message: 'The home telephone number must be exactly 7 digits.',
    action: 'Please enter only the 7-digit telephone number without the area code. If you do not have a home landline, leave this blank.',
    severity: 'warning',
    field: 'homeTelephoneNumber',
    internal: 'HomeTelephoneNumber must be exactly 7 digits.',
  },

  EmailAddress: {
    title: 'Email address was not saved',
    message: 'The email address provided does not appear to be valid.',
    action: 'Please check your email address is entered correctly (e.g. yourname@example.com).',
    severity: 'warning',
    field: 'emailAddress',
    internal: 'EmailAddress exceeded 100 chars or failed format check.',
  },

  // ── Address ─────────────────────────────────────────────────────────────

  PhysicalAddress: {
    title: 'Home address could not be confirmed',
    message: 'The combination of your suburb, city and postal code could not be matched to a known South African address. All three must be correct and match each other exactly.',
    action: 'Please check:\n• Your suburb spelling is correct\n• Your city matches the suburb (e.g. "Sandton" with "Johannesburg", not "Pretoria")\n• Your 4-digit postal code matches the suburb\n\nIf your address is correct but still failing, try using a nearby larger suburb or contact the dealership for assistance.',
    severity: 'warning',
    field: 'physicalAddress',
    internal: 'Address suburb/city/postcode combination not found in Edith lookup table. Common cause: bureau returns address format that doesn\'t match Edith\'s database. May need address correction step in UI.',
  },

  'PhysicalAddress.Suburb': {
    title: 'Suburb not recognised',
    message: 'The suburb you entered could not be found in our address database.',
    action: 'Please check the spelling of your suburb. Try using the suburb name as it appears on official documents or your municipality\'s website.',
    severity: 'warning',
    field: 'physicalAddress.suburb',
    internal: 'Suburb not matching Edith lookup. Check suburb/postcode combination.',
  },

  'PhysicalAddress.City': {
    title: 'City not recognised',
    message: 'The city you entered does not match the suburb and postal code provided.',
    action: 'Please make sure your city, suburb and postal code all belong to the same area. For example, Sandton is in Johannesburg — not Pretoria.',
    severity: 'warning',
    field: 'physicalAddress.city',
    internal: 'City not matching suburb/postcode combination in Edith lookup.',
  },

  'PhysicalAddress.PostCode': {
    title: 'Postal code does not match address',
    message: 'The postal code you entered does not match the suburb and city provided.',
    action: 'Please check your 4-digit postal code matches your suburb. You can find the correct postal code at www.postoffice.co.za or on any official mail you have received.',
    severity: 'warning',
    field: 'physicalAddress.postCode',
    internal: 'PostCode not matching suburb/city in Edith lookup table.',
  },

  'PhysicalAddress.Province': {
    title: 'Province not recognised',
    message: 'The province you selected was not recognised. Your address has been saved without the province.',
    action: 'Please select your province from the dropdown options: Eastern Cape, Free State, Gauteng, KwaZulu-Natal, Limpopo, Mpumalanga, North West, Northern Cape or Western Cape.',
    severity: 'warning',
    field: 'physicalAddress.province',
    internal: 'Province value not in allowed list. Address saved without province.',
  },

  'PhysicalAddress.Country': {
    title: 'Address country not valid',
    message: 'The country entered for your address was not recognised.',
    action: 'Please select "South Africa" as your country if you are a South African resident.',
    severity: 'warning',
    field: 'physicalAddress.country',
    internal: 'Country not in ISO country list. Default to SOUTH AFRICA for SA residents.',
  },

  PreviousPhysicalAddress: {
    title: 'Previous address could not be confirmed',
    message: 'Your previous address could not be matched to a known South African address.',
    action: 'Please check your previous suburb, city and postal code are all correct and match each other. If you cannot remember the exact postal code, try leaving the previous address blank.',
    severity: 'warning',
    field: 'previousPhysicalAddress',
    internal: 'Previous address suburb/city/postcode combination not found.',
  },

  PostalAddress: {
    title: 'Postal address could not be confirmed',
    message: 'Your postal address could not be matched to a known address.',
    action: 'Please check your postal address details. If your postal address is the same as your home address, tick the "Same as home address" option instead.',
    severity: 'warning',
    field: 'postalAddress',
    internal: 'PostalAddress combination not found in lookup. Check AddressType field is set correctly.',
  },

  EmploymentAddress: {
    title: 'Work address could not be confirmed',
    message: 'Your work address could not be matched to a known South African address.',
    action: 'Please check your work suburb, city and postal code are correct. Alternatively, if your work address is the same as your home address, tick the "Same as home address" option.',
    severity: 'warning',
    field: 'employmentAddress',
    internal: 'EmploymentAddress combination not found in lookup.',
  },

  // ── Employment ──────────────────────────────────────────────────────────

  EmploymentType: {
    title: 'Employment status not recognised',
    message: 'The employment status you selected was not recognised.',
    action: 'Please select your employment status from the available options: Employed, Self-Employed, Unemployed or Retired.',
    severity: 'warning',
    field: 'employmentType',
    internal: 'EmploymentType must be [EMPLOYED],[SELF-EMPLOYED],[UNEMPLOYED],[RETIRED].',
  },

  EmployerName: {
    title: 'Employer name was not saved',
    message: 'Your employer name could not be saved as it exceeds the maximum length allowed.',
    action: 'Please shorten your employer name to 50 characters or fewer. You may use a common abbreviation.',
    severity: 'warning',
    field: 'employerName',
    internal: 'EmployerName exceeds max length of 50 characters.',
  },

  Industry: {
    title: 'Industry not recognised',
    message: 'The industry you selected was not found in our system.',
    action: 'Please select your industry from the dropdown list provided. If your industry is not listed, select the closest matching option.',
    severity: 'warning',
    field: 'industry',
    internal: 'Industry value not in Edith industry lookup list.',
  },

  Occupation: {
    title: 'Occupation not recognised',
    message: 'The occupation you entered was not found in our system.',
    action: 'Please select your occupation from the dropdown list. If your exact occupation is not listed, choose the closest matching option.',
    severity: 'warning',
    field: 'occupation',
    internal: 'Occupation not in Edith occupation list. Use exact strings from appendix.',
  },

  OccupationLevel: {
    title: 'Occupation level not recognised',
    message: 'The occupation level you selected was not recognised.',
    action: 'Please select your level from: Senior Management, Management, Supervisor, Skilled Worker, Semi-Skilled Worker, Unskilled Worker or Junior Position.',
    severity: 'warning',
    field: 'occupationLevel',
    internal: 'OccupationLevel not in allowed list.',
  },

  CurrentEmploymentStartDate: {
    title: 'Employment start date was not saved',
    message: 'Your employment start date could not be saved.',
    action: 'Please enter your employment start date in the format DD/MM/YYYY.',
    severity: 'warning',
    field: 'currentEmploymentStartDate',
    internal: 'CurrentEmploymentStartDate format error. Must be dd-mmm-yyyy.',
  },

  // ── Financial & Income ──────────────────────────────────────────────────

  BasicSalary: {
    title: 'Gross salary format not valid',
    message: 'The gross salary amount entered is not in a valid format.',
    action: 'Please enter your gross monthly salary as a number with up to 2 decimal places (e.g. 25000.00). Do not include currency symbols or spaces.',
    severity: 'warning',
    field: 'basicSalary',
    internal: 'BasicSalary money format error. Must be decimal (2dp).',
  },

  NettSalary: {
    title: 'Net salary format not valid',
    message: 'The net take-home salary amount entered is not in a valid format.',
    action: 'Please enter your net monthly take-home salary as a number (e.g. 18500.00). This is the amount deposited into your bank account after all deductions.',
    severity: 'warning',
    field: 'nettSalary',
    internal: 'NettSalary money format error.',
  },

  SalaryDay: {
    title: 'Salary day not valid',
    message: 'The day of the month you receive your salary must be a number between 1 and 31.',
    action: 'Please enter the day of the month your salary is paid (e.g. enter 25 if you are paid on the 25th of each month).',
    severity: 'warning',
    field: 'salaryDay',
    internal: 'SalaryDay must be numeric between 1 and 31.',
  },

  ResidentialStatus: {
    title: 'Residential status not recognised',
    message: 'The residential status you selected was not recognised.',
    action: 'Please select one of the following options:\n• Owner — bond free (own your home outright)\n• Owner — bonded (have a home loan/bond)\n• Tenant (renting)\n• Boarder (living with someone else)',
    severity: 'warning',
    field: 'residentialStatus',
    internal: 'ResidentialStatus must be [OWNER BOND FREE],[OWNER BONDED],[TENANT],[BOARDER].',
  },

  MaritalStatus: {
    title: 'Marital status not recognised',
    message: 'The marital status you selected was not recognised.',
    action: 'Please select one of: Single, Married, Widowed or Divorced.',
    severity: 'warning',
    field: 'maritalStatus',
    internal: 'MaritalStatus must be [SINGLE],[MARRIED],[WIDOWED],[DIVORCED].',
  },

  MarriageType: {
    title: 'Marriage type not recognised',
    message: 'The type of marriage you selected was not recognised.',
    action: 'Please select your marriage type:\n• In Community of Property\n• ANC with Accrual\n• ANC without Accrual\n• Foreign Law\n• Tribal Law\n• Muslim and Hindu Rites\n\nIf you are unsure, check your marriage certificate or speak to the dealership.',
    severity: 'warning',
    field: 'marriageType',
    internal: 'MarriageType not in allowed list. Only required if MaritalStatus = MARRIED.',
  },

  MarriageDate: {
    title: 'Marriage date was not saved',
    message: 'Your marriage date could not be saved.',
    action: 'Please enter your marriage date in the format DD/MM/YYYY as it appears on your marriage certificate.',
    severity: 'warning',
    field: 'marriageDate',
    internal: 'MarriageDate format error. Must be dd-mmm-yyyy.',
  },

  // ── Finance Deal ─────────────────────────────────────────────────────────

  FinanceRate: {
    title: 'Interest rate not valid',
    message: 'The interest rate entered is outside the allowed range.',
    action: 'Please enter an interest rate between 0% and 35%. Enter the rate as a percentage (e.g. enter 14 for 14%). If you are unsure, the dealership will advise you on the applicable rate.',
    severity: 'warning',
    field: 'financeRate',
    internal: 'FinanceRate must be decimal 0.0000–0.3500. Divide percentage by 100 before sending.',
  },

  FinanceTerm: {
    title: 'Finance term not valid',
    message: 'The repayment period selected is not one of the available options.',
    action: 'Please select a repayment period of: 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 72 or 84 months.',
    severity: 'warning',
    field: 'financeTerm',
    internal: 'FinanceTerm must be one of [6,12,18,24,30,36,42,48,54,60,72,84].',
  },

  FinanceRateType: {
    title: 'Interest rate type not recognised',
    message: 'The interest rate type selected was not recognised.',
    action: 'Please select either "Fixed" (rate stays the same) or "Linked" (rate moves with the prime rate).',
    severity: 'warning',
    field: 'financeRateType',
    internal: 'FinanceRateType must be [FIXED] or [LINKED].',
  },

  AgreementType: {
    title: 'Agreement type not recognised',
    message: 'The finance agreement type selected was not recognised.',
    action: 'Please select one of: Instalment Sale, Lease or Rental. The dealership\'s finance team can advise which is appropriate for you.',
    severity: 'warning',
    field: 'agreementType',
    internal: 'AgreementType must be [INSTALLMENT SALE],[LEASE],[RENTAL].',
  },

  PaymentMethod: {
    title: 'Payment method not recognised',
    message: 'The payment method you selected was not recognised.',
    action: 'Please select how you would like to make your monthly payments: Debit Order, Cash, Stop Order, Internet or Other.',
    severity: 'warning',
    field: 'paymentMethod',
    internal: 'PaymentMethod must be [DEBIT ORDER],[CASH],[STOP ORDER],[INTERNET],[OTHER].',
  },

  PaymentDay: {
    title: 'Payment day not valid',
    message: 'The payment day must be a number between 1 and 31.',
    action: 'Please enter the day of the month you would like your payment to go off (e.g. enter 1 for the 1st of each month).',
    severity: 'warning',
    field: 'paymentDay',
    internal: 'PaymentDay must be numeric between 1 and 31.',
  },

  PaymentFrequency: {
    title: 'Payment frequency not recognised',
    message: 'The payment frequency you selected was not recognised.',
    action: 'Please select how often you would like to make payments: Monthly, Quarterly, Bi-Annually or Annually.',
    severity: 'warning',
    field: 'paymentFrequency',
    internal: 'PaymentFrequency must be [MONTHLY],[QUARTERLY],[BI-ANNUALLY],[ANNUALLY].',
  },

  DepositValue: {
    title: 'Deposit amount not valid',
    message: 'The deposit amount entered is not in a valid format.',
    action: 'Please enter your deposit amount as a number (e.g. 50000.00). Do not include currency symbols.',
    severity: 'warning',
    field: 'depositValue',
    internal: 'DepositValue money format error. Note: EFTDepositValue takes precedence if sent.',
  },

  ResidualValue: {
    title: 'Residual value not valid',
    message: 'The residual value entered is not in a valid format, or both a residual value and residual percentage have been provided.',
    action: 'Please enter either a residual value (in Rands) or a residual percentage — not both. The dealership can advise which to use.',
    severity: 'warning',
    field: 'residualValue',
    internal: 'ResidualValue and ResidualPercentage both sent. Only one allowed.',
  },

  // ── Bank Account ─────────────────────────────────────────────────────────

  BankBranchCode: {
    title: 'Bank branch code not valid',
    message: 'The bank branch code entered is not a recognised 6-digit Bankserv code.',
    action: 'Please enter your bank\'s 6-digit universal branch code. You can find this:\n• On your bank statement\n• On your bank\'s website\n• By calling your bank\n\nCommon codes: ABSA 632005 · FNB 250655 · Nedbank 198765 · Standard Bank 051001 · Capitec 470010',
    severity: 'warning',
    field: 'bankBranchCode',
    internal: 'BankBranchCode must be 6-digit Bankserv code. Provide common bank codes as UI hints.',
  },

  AccountNumber: {
    title: 'Account number not valid',
    message: 'The bank account number entered could not be saved.',
    action: 'Please check your account number as it appears on your bank card or statement. It should not exceed 20 digits.',
    severity: 'warning',
    field: 'accountNumber',
    internal: 'AccountNumber exceeds max length of 20.',
  },

  AccountType: {
    title: 'Account type not recognised',
    message: 'The type of bank account you selected was not recognised.',
    action: 'Please select your account type: Cheque, Savings, Transmission or Credit Card.',
    severity: 'warning',
    field: 'accountType',
    internal: 'AccountType must be [CHEQUE],[CREDIT CARD],[SAVINGS],[TRANSMISSION].',
  },

  AccountOpenDate: {
    title: 'Account open date was not saved',
    message: 'The date your bank account was opened could not be saved.',
    action: 'Please enter the date your account was opened in the format DD/MM/YYYY. You can find this on your bank statement or by calling your bank.',
    severity: 'warning',
    field: 'accountOpenDate',
    internal: 'AccountOpenDate format error. Must be dd-mmm-yyyy.',
  },

  // ── Vehicle ──────────────────────────────────────────────────────────────

  VehicleCode: {
    title: 'Vehicle not found',
    message: 'The vehicle selected could not be found in the finance system.',
    action: 'Please contact the dealership to confirm the vehicle details are correct.',
    severity: 'error',
    field: null,
    internal: 'VehicleCode not found in M&M database. Check 8-digit code is current.',
  },

  ChassisVINNumber: {
    title: 'VIN/Chassis number not valid',
    message: 'The VIN or chassis number must be exactly 15 or 17 alphanumeric characters.',
    action: 'Please check the VIN number on the vehicle — it can be found on the dashboard (visible through the windscreen) or on the vehicle registration documents. It should be 17 characters long.',
    severity: 'warning',
    field: 'chassisVINNumber',
    internal: 'ChassisVINNumber must be 15 or 17 alphanumeric chars.',
  },

  VINNumber: {
    title: 'VIN number not valid',
    message: 'The VIN number must be 15 or 17 alphanumeric characters.',
    action: 'Please check the VIN number on the vehicle registration documents or dashboard plate.',
    severity: 'warning',
    field: 'vinNumber',
    internal: 'VINNumber must be 15 or 17 alphanumeric chars.',
  },

  EngineNumber: {
    title: 'Engine number not valid',
    message: 'The engine number must be at least 5 characters long.',
    action: 'Please check the engine number on the vehicle. It is stamped on the engine block and also appears on the registration documents.',
    severity: 'warning',
    field: 'engineNumber',
    internal: 'EngineNumber must be at least 5 characters.',
  },

  RegistrationNumber: {
    title: 'Registration number not saved',
    message: 'The vehicle registration number could not be saved.',
    action: 'Please check the registration number is entered as it appears on the licence plate (e.g. CA 123456).',
    severity: 'warning',
    field: 'registrationNumber',
    internal: 'RegistrationNumber exceeds max length of 20.',
  },

  RetailPrice: {
    title: 'Vehicle price not valid',
    message: 'The vehicle retail price is not in a valid format.',
    action: 'Please enter the vehicle price as a number including cents (e.g. 299999.00). Do not include currency symbols or commas.',
    severity: 'warning',
    field: 'retailPrice',
    internal: 'RetailPrice money format error.',
  },

  NewUsed: {
    title: 'Vehicle condition not recognised',
    message: 'The vehicle condition selected was not recognised.',
    action: 'Please select whether the vehicle is New, Used or Demo.',
    severity: 'warning',
    field: 'newUsed',
    internal: 'NewUsed must be [NEW],[USED],[DEMO].',
  },

  FirstRegistrationDate: {
    title: 'First registration date not valid',
    message: 'The vehicle\'s first registration date could not be saved.',
    action: 'Please enter the date the vehicle was first registered in the format DD/MM/YYYY. For new vehicles, this may be a future date.',
    severity: 'warning',
    field: 'firstRegistrationDate',
    internal: 'FirstRegistrationDate format error. Must be dd-mmm-yyyy. Can be future date for NEW.',
  },

  TyreSize: {
    title: 'Tyre size not valid',
    message: 'The tyre size entered is outside the accepted range.',
    action: 'Please enter a tyre size between 10 and 24 inches. This information can be found on the tyre sidewall or in the vehicle handbook.',
    severity: 'warning',
    field: 'tyreSize',
    internal: 'TyreSize must be numeric between 10 and 24.',
  },

  // ── Consents ─────────────────────────────────────────────────────────────

  DataAttestationInd: {
    title: 'Data consent required',
    message: 'Your consent to collect and process personal information is required to submit this application.',
    action: 'Please read and accept the data processing consent before submitting your application.',
    severity: 'error',
    field: 'dataAttestationInd',
    internal: 'DataAttestationInd required. Must be accepted before CreatePolicy.',
  },

  IdxConsentInd: {
    title: 'Bank statement consent required',
    message: 'Your consent for the bank to obtain your bank statements is required for this application.',
    action: 'Please confirm your consent to allow your bank statements to be accessed as part of the credit assessment.',
    severity: 'warning',
    field: 'idxConsentInd',
    internal: 'IdxConsentInd must be [0] or [-1].',
  },

  IvxConsentInd: {
    title: 'Payslip consent not valid',
    message: 'Your consent for the bank to obtain your payslip details could not be saved.',
    action: 'Please confirm whether you consent to allow your payslip to be accessed as part of the credit assessment.',
    severity: 'warning',
    field: 'ivxConsentInd',
    internal: 'IvxConsentInd must be [0] or [-1].',
  },

  // ── PIP (Politically Influential Persons) ────────────────────────────────

  AffiliatedToPIPInd: {
    title: 'Public official affiliation question required',
    message: 'Please confirm whether you are related to or associated with a public official in a position of authority.',
    action: 'Please answer the question about whether you are related to or associated with a politically influential person.',
    severity: 'warning',
    field: 'affiliatedToPIPInd',
    internal: 'AffiliatedToPIPInd required. Must be [0] or [-1].',
  },

  AffiliationToPIP: {
    title: 'Relationship to public official not recognised',
    message: 'The relationship type to the public official was not recognised.',
    action: 'Please select the nature of your relationship: Close Associate, Son/Daughter, Business Partner, Sibling or Parent.',
    severity: 'warning',
    field: 'affiliationToPIP',
    internal: 'AffiliationToPIP must be [CLOSE ASSOCIATE],[SON/DAUGHTER],[BUSINESS PARTNER],[SIBLING],[PARENT].',
  },

  RetrenchmentNotifyInd: {
    title: 'Retrenchment notification question required',
    message: 'Please confirm whether you have received a retrenchment notification from your employer in the last 6 months.',
    action: 'Please answer the question about whether you have received a Section 189 retrenchment notice from your employer within the last 6 months.',
    severity: 'warning',
    field: 'retrenchmentNotifyInd',
    internal: 'RetrenchmentNotifyInd required. Must be [0] or [-1].',
  },

  // ── Trade-in ─────────────────────────────────────────────────────────────

  TradeInValue: {
    title: 'Trade-in value not valid',
    message: 'The trade-in value entered is not in a valid format.',
    action: 'Please enter the trade-in value as a number (e.g. 85000.00). This is the amount the dealership has offered for your current vehicle.',
    severity: 'warning',
    field: 'tradeInValue',
    internal: 'TradeInValue money format error.',
  },

  TradeInSettlementValue: {
    title: 'Settlement value not valid',
    message: 'The settlement amount you still owe on your trade-in vehicle is not in a valid format.',
    action: 'Please enter the outstanding settlement amount as a number (e.g. 45000.00). You can get this figure from your current finance provider.',
    severity: 'warning',
    field: 'tradeInSettlementValue',
    internal: 'TradeInSettlementValue money format error.',
  },

  // ── Insurance ─────────────────────────────────────────────────────────────

  InsuranceArrangedBy: {
    title: 'Insurance arrangement option not recognised',
    message: 'The insurance arrangement option you selected was not recognised.',
    action: 'Please select one of: Customer Arranged (you have your own insurance), Dealer Referred (insurance arranged through the dealership) or Self Insured.',
    severity: 'warning',
    field: 'insuranceArrangedBy',
    internal: 'InsuranceArrangedBy must be [CUSTOMER ARRANGED],[DEALER REFERRED],[SELF INSURED].',
  },

  InsuranceDriversLicenceType: {
    title: 'Licence type not recognised',
    message: 'The driver\'s licence type you selected was not recognised.',
    action: 'Please select your licence type: A, A1, B, EB, C1, C, EC1, EC or International.',
    severity: 'warning',
    field: 'insuranceDriversLicenceType',
    internal: 'InsuranceDriversLicenceType must be [A],[A1],[B],[EB],[C1],[C],[EC1],[EC],[INTERNATIONAL].',
  },

}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get a user-friendly error for a single Edith field error object.
 * 
 * @param {object} edithError - { FieldName, FieldStatusCode, Description, FieldCategory }
 * @returns {object} { field, title, message, action, severity, raw }
 */
export interface EdithFieldError {
  FieldName: string;
  FieldStatusCode: number;
  Description?: string;
  FieldCategory?: string;
}

export interface ParsedFieldError {
  field: string | null;
  title: string;
  message: string;
  action: string;
  severity: "error" | "warning" | "success";
  raw: { FieldName: string; FieldStatusCode: number; Description?: string };
}

export function getErrorMessage(edithError: EdithFieldError): ParsedFieldError {
  const { FieldName, FieldStatusCode, Description } = edithError;
  const known = (FIELD_ERRORS as Record<string, { title: string; message: string; action: string; severity: string; field: string | null }>)[FieldName];

  if (known) {
    return {
      field: known.field,
      title: known.title,
      message: known.message,
      action: known.action,
      severity: known.severity as ParsedFieldError["severity"],
      raw: { FieldName, FieldStatusCode, Description },
    };
  }

  return {
    field: null,
    title: 'A field could not be saved',
    message: `The field "${FieldName}" could not be processed.`,
    action: 'Please check all your details are correct and try again. If the problem continues, contact the dealership.',
    severity: FieldStatusCode === 300 ? 'error' : 'warning',
    raw: { FieldName, FieldStatusCode, Description },
  };
}

export interface ParsedEdithResponse {
  isSuccess: boolean;
  isFatal: boolean;
  statusCode: number | undefined;
  systemMessage: { title: string; message: string; action: string; severity: string } | null;
  fieldErrors: ParsedFieldError[];
  fatalErrors: ParsedFieldError[];
  warnings: ParsedFieldError[];
  byField: Record<string, ParsedFieldError>;
}

export function parseEdithErrors(edithResponse: {
  StatusCode?: number;
  code?: number;
  success?: boolean;
  Errors?: EdithFieldError[] | EdithFieldError;
  Response?: { StatusCode?: number; Errors?: EdithFieldError[] | EdithFieldError };
} | null | undefined): ParsedEdithResponse {
  const statusCode = edithResponse?.StatusCode ?? edithResponse?.code ?? edithResponse?.Response?.StatusCode;
  const errors = edithResponse?.Errors ?? edithResponse?.Response?.Errors ?? [];

  const isSuccess = edithResponse?.success === true || statusCode === 100 || statusCode === 200;
  const isFatal = statusCode === 300 || (typeof statusCode === "number" && statusCode >= 400);

  const systemMessage = statusCode != null
    ? (SYSTEM_MESSAGES as Record<number, { title: string; message: string; action: string; severity: string }>)[statusCode] ?? null
    : null;

  const fieldErrors = (Array.isArray(errors) ? errors : [errors])
    .filter(Boolean)
    .map(getErrorMessage);

  const fatalErrors = fieldErrors.filter((e) => e.severity === "error");
  const warnings = fieldErrors.filter((e) => e.severity === "warning");

  return {
    isSuccess,
    isFatal,
    statusCode,
    systemMessage,
    fieldErrors,
    fatalErrors,
    warnings,
    byField: fieldErrors.reduce<Record<string, ParsedFieldError>>((acc, err) => {
      if (err.field) acc[err.field] = err;
      return acc;
    }, {}),
  };
}

export function getSummaryMessage(parsed: ParsedEdithResponse): string {
  if (parsed.isSuccess && parsed.warnings.length === 0) {
    return "Your application was submitted successfully.";
  }
  if (parsed.isSuccess && parsed.warnings.length > 0) {
    return `Your application was submitted, but ${parsed.warnings.length} field(s) could not be saved. Please review the highlighted items.`;
  }
  if (parsed.systemMessage) return parsed.systemMessage.message;
  if (parsed.fatalErrors.length > 0) {
    return "Your application could not be submitted. Please correct the highlighted fields and try again.";
  }
  return "There was a problem submitting your application. Please try again.";
}

