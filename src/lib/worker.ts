/**
 * Worker API client. All calls go through VITE_WORKER_URL.
 * When the env var is missing (e.g. Lovable preview without a backend),
 * the client returns deterministic mock responses so the wizard keeps working.
 */
import type { WizardData } from "@/components/wizard/types";

const WORKER = import.meta.env.VITE_WORKER_URL as string | undefined;
const DEFAULT_DEALER = "findndrive";

function headers(dealerKey?: string) {
  return {
    "Content-Type": "application/json",
    "X-Dealer-Key": dealerKey || DEFAULT_DEALER,
  };
}

export interface PreQualResponse {
  applicantId: string;
  monthlyAmount: number;
  totalAmount: number;
}

export interface PredictionResponse {
  prediction: { label: "In progress" | "Good news" | "Great news" };
  reason: string;
  estimatedApprovalAmount: number;
  monthlyInstalment: number;
}

export interface PolicyResponse {
  policyNumber?: string;
  salesRef?: string;
  StatusCode?: number;
  code?: number;
  success?: boolean;
  manualFollowUp?: boolean;
  warnings?: Array<{ field: string; title: string; message: string; action: string; severity: string }>;
  errors?: Array<{ field: string; title: string; message: string; action: string; severity: string }>;
  Errors?: Array<{ FieldName: string; FieldStatusCode: number; Description?: string }>;
}

export interface ApplicantResponse {
  title?: string;
  emailAddress?: string;
  maritalStatus?: string;
  employerName?: string;
  township?: string;
  city?: string;
  postalCode?: string;
  bureauExpenses?: number;
  address1?: string;
  suburb?: string;
  province?: string;
  occupation?: string;
  occupationLevel?: string;
  industry?: string;
  salaryDay?: string;
  currentEmploymentStartDate?: string;
  gender?: string;
  educationLevel?: string;
}

export interface SubmitDocumentsPayload {
  policyNumber: string;
  salesRef?: string;
  documents: Array<{
    category: string;
    description?: string;
    base64: string;
    fileExtension: string;
  }>;
}

export interface SubmitDocumentsResponse {
  success: boolean;
  policyNumber?: string;
  message?: string;
  error?: string;
  code?: number;
}

async function call<T>(
  path: string,
  init: RequestInit,
  dealerKey?: string,
  mock?: () => T,
): Promise<T> {
  if (!WORKER) {
    await new Promise((r) => setTimeout(r, 600));
    if (mock) return mock();
    throw new Error("VITE_WORKER_URL not configured");
  }

  const res = await fetch(`${WORKER}${path}`, {
    ...init,
    headers: { ...headers(dealerKey), ...(init.headers || {}) },
  });

  // Always parse body first
  let json: any = {};
  try { json = await res.json(); } catch { /* ignore */ }

  // Throw only for genuine failures — not 422 Edith validation errors
  if (!res.ok && res.status !== 422) {
    const err: any = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    err.systemDown = json?.systemDown ?? false;
    err.idasFailed = json?.idasFailed ?? false;
    err.code = json?.code ?? res.status;
    throw err;
  }

  // Handle idasFailed returned as 200
  if (json?.idasFailed) {
    const err: any = new Error("IDAS bureau failure");
    err.idasFailed = true;
    throw err;
  }

  return json as T;
}

export const workerApi = {
  preQualify(data: Partial<WizardData>, dealerKey?: string) {
    return call<PreQualResponse>(
      "/api/financing/pre-qualification",
      {
        method: "POST",
        body: JSON.stringify({
          ...data,
          firstName: data.name,
          lastName: data.surname,
          mobileNumber: data.mobile,
        }),
      },
      dealerKey,
      () => {
        const net = Number(data.netIncome) || 0;
        const monthly = Math.round(net * 0.3);
        return {
          applicantId: `mock-${Date.now()}`,
          monthlyAmount: monthly,
          totalAmount: monthly * 50,
        };
      },
    );
  },

  predict(data: Partial<WizardData>, dealerKey?: string) {
    return call<PredictionResponse>(
      "/api/financing/prediction",
      { method: "POST", body: JSON.stringify(data) },
      dealerKey,
      () => {
        const net = Number(data.netIncome) || 0;
        const exp = Number(data.livingExpenses) || 0;
        const ratio = net > 0 ? exp / net : 1;
        const label: PredictionResponse["prediction"]["label"] =
          net >= 25000 && ratio < 0.4
            ? "Great news"
            : net >= 12000 && ratio < 0.6
              ? "Good news"
              : "In progress";
        const monthly = Math.round(net * 0.3);
        return {
          prediction: { label },
          reason:
            "Pay all your accounts on time, every month, to maintain a healthy credit score.",
          estimatedApprovalAmount: monthly * 50,
          monthlyInstalment: monthly,
        };
      },
    );
  },

  createPolicy(data: Partial<WizardData>, dealerKey?: string) {
    return call<PolicyResponse>(
      "/api/policy/create",
      { method: "POST", body: JSON.stringify(data) },
      dealerKey,
      () => ({
        policyNumber: `POL${Date.now().toString().slice(-8)}`,
        salesRef: undefined,
        StatusCode: 100,
        code: 100,
        success: true,
        Errors: [],
      }),
    );
  },

  getApplicant(applicantId: string, dealerKey?: string) {
    return call<ApplicantResponse>(
      `/api/financing/applicant?applicantId=${encodeURIComponent(applicantId)}`,
      { method: "GET" },
      dealerKey,
      () => ({
        title: undefined,
        emailAddress: undefined,
        maritalStatus: undefined,
        employerName: undefined,
        township: undefined,
        city: undefined,
        postalCode: undefined,
      }),
    );
  },

  submitDocuments(data: SubmitDocumentsPayload, dealerKey?: string) {
    return call<SubmitDocumentsResponse>(
      "/api/policy/documents",
      { method: "POST", body: JSON.stringify(data) },
      dealerKey,
      () => ({
        success: true,
        policyNumber: data.policyNumber,
        message: "Documents submitted (mock)",
      }),
    );
  },
};