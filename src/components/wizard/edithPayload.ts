import type { WizardData } from "./types";

/**
 * Maps WizardData → Edith CreatePolicy payload.
 * Shared between Step3 (Manual), Step3Bike, and Step3Fast.
 * Optional branchCodeOverride used for multi-branch dealer groups.
 */
export function buildEdithPayload(data: WizardData, branchCodeOverride?: string) {
  const isMarried = data.maritalStatus === "Married";
  return {
    title: data.title?.toUpperCase(),
    firstName: data.name,
    lastName: data.surname,
    idType: data.idType.toUpperCase(),
    idNumber: data.idNumber,
    mobileNumber: data.mobile.replace(/\D/g, ""),
    emailAddress: data.email,
    educationLevel: data.educationLevel || undefined,
    maritalStatus: data.maritalStatus?.toUpperCase(),
    marriageType: isMarried ? data.marriageType || undefined : undefined,
    marriageDate: isMarried ? data.marriageDate || undefined : undefined,
    spouseFirstName: isMarried ? data.spouseFirstName || undefined : undefined,
    spouseLastName: isMarried ? data.spouseLastName || undefined : undefined,
    spouseIdNumber: isMarried ? data.spouseIdNumber || undefined : undefined,
    spouseIdType: isMarried ? (data.spouseIdType || "RSA ID") : undefined,
    address1: data.address1,
    postalLocationId: data.postalLocation?.id,
    suburb: data.postalLocation?.suburb,
    city: data.postalLocation?.city,
    postCode: data.postalLocation?.postal_code,
    residentialStatus: mapResidential(data.residentialStatus),
    physicalAddressDate: data.physicalAddressDate ? formatEdithDate(data.physicalAddressDate) : undefined,
    nextOfKinFirstName: data.nokFirst,
    nextOfKinLastName: data.nokLast,
    nextOfKinMobile: data.nokContact.replace(/\D/g, ""),
    employmentType: mapEmployment(data.employmentType),
    employerName: data.employmentType === "Pensioner/Retired" ? undefined : data.employerName,
    salaryDay: data.employmentType === "Pensioner/Retired" ? undefined : Number(data.salaryDay) || undefined,
    occupation: data.occupation || undefined,
    occupationLevel: data.occupationLevel || undefined,
    industry: data.industry || undefined,
    gender: data.idType === "RSA ID" && data.idNumber?.length === 13
      ? (parseInt(data.idNumber.substring(6, 10)) >= 5000 ? "MALE" : "FEMALE")
      : undefined,
    bureauExpenses: data.bureauExpenses || undefined,
    currentEmploymentStartDate: data.currentEmploymentStartDate
      ? formatEdithDate(data.currentEmploymentStartDate)
      : undefined,
    basicSalary: Number(data.confirmGross) || undefined,
    nettSalary: Number(data.confirmNet) || undefined,
    depositAmount: Number(data.confirmDeposit) > 0 ? Number(data.confirmDeposit) : undefined,
    dataAttestation: data.dataAttestation,
    financialAccessConsent: data.financialAccessConsent,
    marketingConsent: data.marketingConsent,
    vehicleMake: data.vehicleMake,
    vehicleModel: data.vehicleModel,
    vehicleMm: data.vehicleMm,
    estimatedApprovalAmount: data.estimatedApprovalAmount ??
      (data.idType !== "RSA ID" ? Number(data.preQualTotal) || undefined : undefined),
    preQualTotal: data.preQualTotal,
    applicantId: data.applicantId,
    bankBranchCode: data.bankBranchCode || undefined,
    bankName: data.bankName || undefined,
    accountType: data.accountType || undefined,
    bankAccountNumber: data.bankAccountNumber || undefined,
    // Branch code override for multi-branch dealer groups
    branchCodeOverride: branchCodeOverride || undefined,
  };
}

export function mapResidential(v: string): string | undefined {
  switch (v) {
    case "Owner (no bond)": return "OWNER BOND FREE";
    case "Owner (bonded)": return "OWNER BONDED";
    case "Tenant": return "TENANT";
    case "Other": return "BOARDER";
    default: return undefined;
  }
}

export function mapEmployment(v: WizardData["employmentType"]): string | undefined {
  switch (v) {
    case "Employed":
    case "Contract":
      return "EMPLOYED";
    case "Self-employed":
      return "SELF-EMPLOYED";
    case "Pensioner/Retired":
      return "RETIRED";
    default:
      return undefined;
  }
}

export function formatEdithDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
}