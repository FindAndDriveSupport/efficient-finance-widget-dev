import type { PostalLocation } from "./AddressLookup";

export interface WizardData {
  // Step 1
  name: string;
  surname: string;
  netIncome: number | "";
  mobile: string;
  hasDeposit: boolean;
  depositAmount: number | "";
  hasFinance: boolean;
  financeAmount: number | "";

  // Step 2
  grossIncome: number | "";
  hasSAID: boolean;
  idNumber: string;
  livingExpenses: number | "";

  // Consents
  consents1: boolean[];
  consents2: boolean[];

  // Pre-qual + prediction (worker responses)
  applicantId?: string;
  preQualMonthly?: number;
  preQualTotal?: number;
  predictionLabel?: "In progress" | "Good news" | "Great news";
  predictionReason?: string;
  estimatedApprovalAmount?: number;
  monthlyInstalment?: number;

  // Step 3 — Personal
  title: string;
  idType: "RSA ID" | "Passport" | "Other ID";
  email: string;
  maritalStatus: string;
  marriageType: string;
  marriageDate: string;
  educationLevel: string;

  // Step 3 — Spouse (required if married)
  spouseFirstName: string;
  spouseLastName: string;
  spouseIdNumber: string;
  spouseIdType: string;

  // Step 3 — Address
  address1: string;
  postalLocation: PostalLocation | null;
  residentialStatus: string;
  physicalAddressDate: string;

  // Step 3 — Next of kin
  nokFirst: string;
  nokLast: string;
  nokContact: string;

  // Step 3 — Employment
  employmentType: "Employed" | "Self-employed" | "Contract" | "Pensioner/Retired" | "";
  employerName: string;
  occupation: string;
  currentEmploymentStartDate: string;
  bureauExpenses: number | "";
  occupationLevel: string;
  industry: string;
  salaryDay: string;

  // Step 3 — Financial confirmation
  confirmGross: number | "";
  confirmNet: number | "";
  confirmDeposit: number | "";

  // Step 3 — Consents
  dataAttestation: boolean;
  financialAccessConsent: boolean;
  marketingConsent: boolean;

  // Vehicle (from embed)
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleMm?: string;
  dealership?: string;

  // Banking (bike only)
  bankName?: string;
  bankBranchCode?: string;
  accountType?: string;
  bankAccountNumber?: string;

  [k: string]: unknown;
}

export const initialData: WizardData = {
  name: "",
  surname: "",
  netIncome: "",
  mobile: "",
  hasDeposit: false,
  depositAmount: "",
  hasFinance: false,
  financeAmount: "",

  grossIncome: "",
  hasSAID: true,
  idNumber: "",
  livingExpenses: "",

  consents1: [false, false, false, false],
  consents2: [false, false, false, false, false, false],

  title: "",
  idType: "RSA ID",
  email: "",
  maritalStatus: "",
  marriageType: "",
  marriageDate: "",
  educationLevel: "",

  spouseFirstName: "",
  spouseLastName: "",
  spouseIdNumber: "",
  spouseIdType: "RSA ID",

  address1: "",
  postalLocation: null,
  residentialStatus: "",
  physicalAddressDate: "",

  nokFirst: "",
  nokLast: "",
  nokContact: "",

  employmentType: "",
  employerName: "",
  occupation: "",
  currentEmploymentStartDate: "",
  bureauExpenses: "",
  occupationLevel: "",
  industry: "",
  salaryDay: "",

  confirmGross: "",
  confirmNet: "",
  confirmDeposit: "",

  dataAttestation: false,
  financialAccessConsent: false,
  marketingConsent: false,

  bankName: "",
  bankBranchCode: "",
  accountType: "",
  bankAccountNumber: "",
};
