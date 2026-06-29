import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StepHeader } from "./StepHeader";
import { CurrencyInput } from "./CurrencyInput";
import { AddressLookup, type PostalLocation } from "./AddressLookup";
import { TypingInput } from "./TypingInput";
import { LookupSelect } from "./LookupSelect";
import { EdithErrorBanner } from "./EdithErrorBanner";
import { FieldErrorHint } from "./FieldErrorHint";
import { validateSAID } from "./validation";
import type { WizardData } from "./types";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEmbed } from "@/contexts/EmbedContext";
import { useDealer } from "@/contexts/DealerContext";
import { workerApi } from "@/lib/worker";
import { parseEdithErrors, type ParsedEdithResponse } from "@/lib/edithErrors";
import {
  usePageTimer,
  trackStep3Started,
  trackStep3SubmitApplication,
  trackStep3SubmitApplicationResult,
} from "@/lib/mixpanel";
import { buildEdithPayload } from "./edithPayload";
import { logEvent } from "@/lib/logEvent";

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof", "Adv", "Hon", "Rev"];
const ID_TYPES = ["RSA ID", "Passport", "Other ID"] as const;
const MARITAL = ["Single", "Married", "Widowed", "Divorced"];
const MARRIAGE_TYPES = [
  "ANC with Accrual",
  "In Community of Property",
  "ANC without Accrual",
  "Foreign Law",
  "Tribal Law",
  "Muslim and Hindu Rites",
];
const RESIDENTIAL = ["Owner (no bond)", "Owner (bonded)", "Tenant", "Other"];
const EMPLOYMENT = ["Employed", "Self-employed", "Contract", "Pensioner/Retired"] as const;
const EDUCATION_LEVELS = [
  "NO SCHOOLING",
  "INCOMPLETE PRIMARY",
  "COMPLETED PRIMARY (GRADE 7)",
  "GET CERTIFICATE (GRADE 9)",
  "MATRIC CERTIFICATE (GRADE 12)",
  "DIPLOMA",
  "BACHELORS DEGREE",
  "POSTGRADUATE DIPLOMA",
  "HONOURS DEGREE",
  "PROFESSIONAL QUALIFICATION",
  "MASTERS DEGREE",
  "DOCTORATE",
];

const EDITH_MAP: Record<string, string> = {
  LastName: "surname",
  FirstName: "name",
  IDNumber: "idNumber",
  Title: "title",
  EmailAddress: "email",
  MobileNumber: "mobile",
  MaritalStatus: "maritalStatus",
  EmploymentType: "employmentType",
  EmployerName: "employerName",
  SalaryDay: "salaryDay",
  BasicSalary: "confirmGross",
  NettSalary: "confirmNet",
  EFTDepositValue: "confirmDeposit",
};

function capitalise(s?: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function Step3({ data, setData, back, onSwitchToFast, onComplete }: {
  data: WizardData;
  setData: (d: WizardData) => void;
  back: () => void;
  onSwitchToFast?: () => void;
  onComplete?: () => void;
}) {
  usePageTimer("Step 3 - Full Application");
  const embed = useEmbed();
  const dealer = useDealer();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ policyNumber?: string; salesRef?: string; manualFollowUp?: boolean } | null>(null);
  const [errors, setErrors] = useState<ParsedEdithResponse | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [selectedBranchCode, setSelectedBranchCode] = useState<string>(
    dealer.branches?.[0]?.code ?? dealer.branchCode
  );

  const submittedRef = useRef(false);

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setData({ ...data, [k]: v });

  const isMarried = data.maritalStatus === "Married";
  const isRetired = data.employmentType === "Pensioner/Retired";

  const fieldChecks: boolean[] = [
    !!data.dealership,
    !!data.vehicleMake,
    !!data.vehicleModel,
    !!data.title,
    !!data.name,
    !!data.surname,
    !!data.idNumber,
    !!data.mobile,
    !!data.email,
    !!data.educationLevel,
    !!data.maritalStatus,
    !isMarried || !!data.marriageType,
    !isMarried || !!data.marriageDate,
    !isMarried || !!data.spouseFirstName,
    !isMarried || !!data.spouseLastName,
    !!data.address1,
    !!data.postalLocation,
    !!data.residentialStatus,
    !!data.physicalAddressDate,
    !!data.nokFirst,
    !!data.nokLast,
    !!data.nokContact,
    !!data.employmentType,
    isRetired || !!data.employerName,
    isRetired || !!data.salaryDay,
    isRetired || !!data.currentEmploymentStartDate,
    !!data.confirmGross,
    !!data.confirmNet,
    !data.hasDeposit || !!data.confirmDeposit,
    data.dataAttestation && data.financialAccessConsent,
  ];
  const completedFields = fieldChecks.filter(Boolean).length;
  const totalFields = fieldChecks.length;
  const pct = Math.round((completedFields / totalFields) * 100);

  useEffect(() => { trackStep3Started(); }, []);

  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        logEvent('warn', 'form_abandoned', {
          dealer: dealer.key,
          completedPct: pct,
          applicantId: data.applicantId || null,
        }, dealer.key);
      }
    };
  }, []);

  useEffect(() => {
    const patch: Partial<WizardData> = {};
    if (embed.make) patch.vehicleMake = embed.make;
    if (embed.model) patch.vehicleModel = embed.model;
    if (embed.mm) patch.vehicleMm = embed.mm;
    if (dealer.name) patch.dealership = dealer.name;
    if (data.grossIncome) patch.confirmGross = data.grossIncome;
    if (data.netIncome) patch.confirmNet = data.netIncome;
    if (data.hasDeposit && data.depositAmount) patch.confirmDeposit = data.depositAmount;

    if (!data.applicantId) {
      if (Object.keys(patch).length) setData({ ...data, ...patch });
      return;
    }

    workerApi.getApplicant(data.applicantId, embed.dealer)
      .then(async (res) => {
        if (res.title) patch.title = capitalise(res.title);
        if (res.emailAddress) patch.email = res.emailAddress;
        if (res.maritalStatus) patch.maritalStatus = capitalise(res.maritalStatus);
        if (res.employerName) { patch.employmentType = "Employed"; patch.employerName = res.employerName; }
        if (res.bureauExpenses) patch.bureauExpenses = res.bureauExpenses;
        if (!data.postalLocation && (res.township || res.city || res.postalCode)) {
          const q = res.township || res.city || res.postalCode;
          try {
            const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined;
            if (workerUrl && q) {
              const r = await fetch(
                `${workerUrl}/api/address-search?q=${encodeURIComponent(q)}`,
                { headers: { "X-Dealer-Key": embed.dealer ?? "" } }
              );
              const json = await r.json();
              const locations: PostalLocation[] = json.results || [];
              if (locations.length > 0) patch.postalLocation = locations[0];
            }
          } catch (e) {
            console.warn("[Step3] auto address resolve failed", e);
          }
        }
        setData({ ...data, ...patch });
      })
      .catch((e) => console.warn("[Step3] getApplicant failed", e));
  }, [dealer.name]);

  useEffect(() => {
    if (data.maritalStatus === "Married" && data.spouseFirstName) {
      setData({
        ...data,
        nokFirst: data.spouseFirstName,
        nokLast: data.spouseLastName,
      });
    }
  }, [data.spouseFirstName, data.spouseLastName]);

  const errorByField = (() => {
    if (!errors) return {} as Record<string, { title: string; message: string; action: string }>;
    const map: Record<string, { title: string; message: string; action: string }> = {};
    for (const e of errors.fieldErrors) {
      if (!e.field) continue;
      const local = EDITH_MAP[e.field] ?? e.field;
      map[local] = { title: e.title, message: e.message, action: e.action };
    }
    return map;
  })();

  const onSubmit = async () => {
    if (!data.title) { toast.error("Title is required."); return; }
    if (!data.name.trim()) { toast.error("First name is required."); return; }
    if (!data.surname.trim()) { toast.error("Last name is required."); return; }
    if (!data.idNumber.trim()) { toast.error("ID / Passport number is required."); return; }
    if (data.idType === "RSA ID" && data.idNumber) {
      const err = validateSAID(data.idNumber);
      setIdError(err);
      if (err) return;
    }
    if (!data.mobile.trim()) { toast.error("Mobile number is required."); return; }
    if (!data.email.trim()) { toast.error("Email address is required."); return; }
    if (!data.educationLevel) { toast.error("Education level is required."); return; }
    if (!data.maritalStatus) { toast.error("Marital status is required."); return; }
    if (isMarried && !data.marriageType) { toast.error("Marriage contract type is required."); return; }
    if (isMarried && !data.marriageDate) { toast.error("Marriage date is required."); return; }
    if (isMarried && !data.spouseFirstName?.trim()) { toast.error("Spouse first name is required."); return; }
    if (isMarried && !data.spouseLastName?.trim()) { toast.error("Spouse last name is required."); return; }
    if (!data.address1.trim()) { toast.error("Street address is required."); return; }
    if (!data.postalLocation) {
      setAddressError("Please select a suburb from the list.");
      toast.error("Suburb / postal code is required.");
      return;
    }
    if (!data.residentialStatus) { toast.error("Residential status is required."); return; }
    if (!data.physicalAddressDate) { toast.error("Date moved in is required."); return; }
    if (!data.nokFirst.trim()) { toast.error("Next of kin first name is required."); return; }
    if (!data.nokLast.trim()) { toast.error("Next of kin last name is required."); return; }
    if (!data.nokContact.trim()) { toast.error("Next of kin contact number is required."); return; }
    if (!data.employmentType) { toast.error("Employment status is required."); return; }
    if (!isRetired) {
      if (!data.employerName.trim()) { toast.error("Employer name is required."); return; }
      if (!data.salaryDay) { toast.error("Salary day is required."); return; }
      if (!data.currentEmploymentStartDate) { toast.error("Employment start date is required."); return; }
      if (!data.occupation) { toast.error("Occupation is required."); return; }
      if (!data.occupationLevel) { toast.error("Occupation level is required."); return; }
      if (!data.industry) { toast.error("Industry is required."); return; }
    }
    if (!Number(data.confirmGross)) { toast.error("Gross monthly salary is required."); return; }
    if (!Number(data.confirmNet)) { toast.error("Net salary is required."); return; }
    if (!data.dataAttestation || !data.financialAccessConsent) {
      toast.error("Please accept the consent declaration.");
      return;
    }
    setAddressError(null);

    trackStep3SubmitApplication();
    setSubmitting(true);
    setErrors(null);

    try {
      const payload = buildEdithPayload(data, selectedBranchCode);
      const res = await workerApi.createPolicy(payload, dealer.key !== "default" ? dealer.key : embed.dealer);
      const parsed = parseEdithErrors(res);

      if (!parsed.isSuccess) {
        setErrors(parsed);
        trackStep3SubmitApplicationResult(false, { fieldErrorCount: parsed.fieldErrors?.length ?? 0 });
        toast.error("Please review the highlighted items");
        setSubmitting(false);
        return;
      }

      if (res.manualFollowUp) {
        trackStep3SubmitApplicationResult(true, { manualFollowUp: true, salesRef: res.salesRef });
        toast.success("Application received");
        submittedRef.current = true;
        setSubmitted({ salesRef: res.salesRef, manualFollowUp: true });
        onComplete?.();
        return;
      }

      submittedRef.current = true;
      setSubmitted({ policyNumber: res.policyNumber, salesRef: res.salesRef });
      onComplete?.();
      trackStep3SubmitApplicationResult(true, {
        policyNumber: res.policyNumber,
        salesRef: res.salesRef,
      });
      toast.success("Application submitted");

    } catch (err: any) {
      console.error(err);
      logEvent('error', 'policy_submission_failed', {
        dealer: dealer.key,
        error: err.message,
        idasFailed: err.idasFailed ?? false,
      }, dealer.key);
      if (err.idasFailed) {
        toast.error("We could not verify your ID. Please check your details.");
      } else {
        trackStep3SubmitApplicationResult(false, { networkError: true });
        toast.error("Unable to connect. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold">Application submitted</h2>
        {(submitted.policyNumber || submitted.salesRef) && (
          <p className="mt-2 text-sm font-medium">
            Reference: <span className="font-mono">{submitted.policyNumber || submitted.salesRef}</span>
          </p>
        )}
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          A member of our finance team will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader step={3} total={3} title="Full application" subtitle="Complete the sections below to submit." onBack={back} />

      {onSwitchToFast && (
        <button
          type="button"
          onClick={onSwitchToFast}
          className="w-full rounded-xl border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60"
        >
          Don't want to fill out the long form?{" "}
          <span
            className="font-semibold underline"
            style={{ color: "var(--dealer-primary, var(--primary))" }}
          >Try our fast application</span> — just upload your documents and we'll handle the rest.
        </button>
      )}

      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b border-border">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Application progress</span>
          <span>{pct}% complete</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }}
          />
        </div>
      </div>

      {/* Branch selector — only shown for multi-branch dealers */}
      {dealer.branches && dealer.branches.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-semibold mb-3">Select your branch</h3>
          <div className="grid grid-cols-1 gap-2">
            {dealer.branches.map((b) => (
              <label
                key={b.code}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  selectedBranchCode === b.code
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="branch"
                  value={b.code}
                  checked={selectedBranchCode === b.code}
                  onChange={() => setSelectedBranchCode(b.code)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">{b.code}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {errors?.systemMessage && (
        <EdithErrorBanner
          title={errors.systemMessage.title}
          message={errors.systemMessage.message}
          action={errors.systemMessage.action}
        />
      )}

      <Accordion type="multiple" defaultValue={["vehicle", "personal", "address"]} className="space-y-3">
        <Section id="vehicle" title="Vehicle & dealership">
          <FieldRow label="Dealership">
            <TypingInput
              value={data.dealership ?? ""}
              onChange={(v) => set("dealership", v)}
              phrases={["Search dealership…", "e.g. Standard Bank Motors", "Start typing to search…"]}
            />
          </FieldRow>
          <Grid2>
            <FieldRow label="Vehicle make">
              <TypingInput
                value={data.vehicleMake ?? ""}
                onChange={(v) => set("vehicleMake", v)}
                phrases={["e.g. Toyota", "e.g. Volkswagen", "e.g. Ford"]}
              />
            </FieldRow>
            <FieldRow label="Vehicle model">
              <TypingInput
                value={data.vehicleModel ?? ""}
                onChange={(v) => set("vehicleModel", v)}
                phrases={["e.g. Corolla", "e.g. Polo", "e.g. Ranger"]}
              />
            </FieldRow>
          </Grid2>
        </Section>

        <Section id="personal" title="Personal details">
          <FieldRow label="Title">
            <SelectInput value={data.title} onChange={(v) => set("title", v)} options={TITLES} />
          </FieldRow>
          <Grid2>
            <FieldRow label="First name">
              <Input value={data.name} onChange={(e) => set("name", e.target.value)} />
              {errorByField.name && <FieldErrorHint {...errorByField.name} />}
            </FieldRow>
            <FieldRow label={<><span>Last name</span> <span className="text-destructive">*</span></>}>
              <Input value={data.surname} onChange={(e) => set("surname", e.target.value)} aria-invalid={!data.surname} />
              {errorByField.surname && <FieldErrorHint {...errorByField.surname} />}
            </FieldRow>
          </Grid2>
          <Grid2>
            <FieldRow label="ID / Passport type">
              <SelectInput value={data.idType} onChange={(v) => set("idType", v as WizardData["idType"])} options={ID_TYPES as unknown as string[]} />
            </FieldRow>
            <FieldRow label="ID / Passport number">
              <Input
                value={data.idNumber}
                maxLength={data.idType === "RSA ID" ? 13 : 30}
                inputMode={data.idType === "RSA ID" ? "numeric" : "text"}
                onChange={(e) => {
                  const v = data.idType === "RSA ID" ? e.target.value.replace(/\D/g, "") : e.target.value;
                  set("idNumber", v);
                  if (data.idType === "RSA ID") setIdError(validateSAID(v));
                }}
                onBlur={() => data.idType === "RSA ID" && setIdError(validateSAID(data.idNumber))}
              />
              {idError && data.idType === "RSA ID" && (
                <p className="mt-1 text-xs text-destructive">⚠ {idError}</p>
              )}
              {errorByField.idNumber && <FieldErrorHint {...errorByField.idNumber} />}
            </FieldRow>
          </Grid2>
          <Grid2>
            <FieldRow label="Mobile number">
              <Input
                value={data.mobile}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => set("mobile", e.target.value.replace(/\D/g, ""))}
              />
            </FieldRow>
            <FieldRow label="Email address">
              <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
            </FieldRow>
          </Grid2>
          <FieldRow label="Education level">
            <SelectInput value={data.educationLevel} onChange={(v) => set("educationLevel", v)} options={EDUCATION_LEVELS} />
          </FieldRow>
          <FieldRow label="Marital status">
            <SelectInput value={data.maritalStatus} onChange={(v) => set("maritalStatus", v)} options={MARITAL} />
          </FieldRow>
          {isMarried && (
            <>
              <Grid2>
                <FieldRow label="Marriage contract *">
                  <SelectInput value={data.marriageType} onChange={(v) => set("marriageType", v)} options={MARRIAGE_TYPES} />
                </FieldRow>
                <FieldRow label="Marriage date *">
                  <Input
                    type="date"
                    value={data.marriageDate ?? ""}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => set("marriageDate", e.target.value)}
                    className="pr-3 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </FieldRow>
              </Grid2>
              <p className="text-xs font-semibold text-foreground pt-1">Spouse details</p>
              <Grid2>
                <FieldRow label="Spouse first name *">
                  <Input value={data.spouseFirstName ?? ""} onChange={(e) => set("spouseFirstName", e.target.value)} />
                </FieldRow>
                <FieldRow label="Spouse last name *">
                  <Input value={data.spouseLastName ?? ""} onChange={(e) => set("spouseLastName", e.target.value)} />
                </FieldRow>
              </Grid2>
              <Grid2>
                <FieldRow label="Spouse ID type">
                  <SelectInput
                    value={data.spouseIdType ?? "RSA ID"}
                    onChange={(v) => set("spouseIdType", v)}
                    options={["RSA ID", "Passport", "Other ID"]}
                  />
                </FieldRow>
                <FieldRow label="Spouse ID number">
                  <Input
                    value={data.spouseIdNumber ?? ""}
                    inputMode={(data.spouseIdType ?? "RSA ID") === "RSA ID" ? "numeric" : "text"}
                    maxLength={(data.spouseIdType ?? "RSA ID") === "RSA ID" ? 13 : 30}
                    onChange={(e) => {
                      const v = (data.spouseIdType ?? "RSA ID") === "RSA ID"
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value;
                      set("spouseIdNumber", v);
                    }}
                  />
                </FieldRow>
              </Grid2>
            </>
          )}
        </Section>

        <Section id="address" title="Residential address">
          <FieldRow label="Street address">
            <Input maxLength={50} value={data.address1} onChange={(e) => set("address1", e.target.value)} />
          </FieldRow>
          <AddressLookup
            value={data.postalLocation}
            onSelect={(loc) => { set("postalLocation", loc); setAddressError(null); }}
            error={addressError}
          />
          <Grid2>
            <FieldRow label="Residential status">
              <SelectInput value={data.residentialStatus} onChange={(v) => set("residentialStatus", v)} options={RESIDENTIAL} />
            </FieldRow>
            <FieldRow label="Date moved in">
              <Input
                type="date"
                value={data.physicalAddressDate}
                onChange={(e) => set("physicalAddressDate", e.target.value)}
                className="pr-3 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </FieldRow>
          </Grid2>
        </Section>

        <Section id="nok" title="Next of kin">
          <Grid2>
            <FieldRow label="First name">
              <Input value={data.nokFirst} onChange={(e) => set("nokFirst", e.target.value)} />
            </FieldRow>
            <FieldRow label="Last name">
              <Input value={data.nokLast} onChange={(e) => set("nokLast", e.target.value)} />
            </FieldRow>
          </Grid2>
          <FieldRow label="Contact number">
            <Input
              value={data.nokContact}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => set("nokContact", e.target.value.replace(/\D/g, ""))}
            />
          </FieldRow>
        </Section>

        <Section id="employment" title="Employment">
          <FieldRow label="Employment status">
            <SelectInput
              value={data.employmentType}
              onChange={(v) => set("employmentType", v as WizardData["employmentType"])}
              options={EMPLOYMENT as unknown as string[]}
            />
          </FieldRow>
          {!isRetired && (
            <>
              <Grid2>
                <FieldRow label="Employer name">
                  <Input maxLength={50} value={data.employerName} onChange={(e) => set("employerName", e.target.value)} />
                  {errorByField.employerName && <FieldErrorHint {...errorByField.employerName} />}
                </FieldRow>
                <FieldRow label="Salary day (1–31)">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={data.salaryDay}
                    onChange={(e) => set("salaryDay", e.target.value)}
                  />
                </FieldRow>
              </Grid2>
              <FieldRow label="Employment start date">
                <Input
                  type="date"
                  value={data.currentEmploymentStartDate}
                  onChange={(e) => set("currentEmploymentStartDate", e.target.value)}
                  className="pr-3 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </FieldRow>
              <FieldRow label="Occupation">
                <LookupSelect
                  value={data.occupation}
                  onChange={(v) => set("occupation", v)}
                  endpoint="/api/lookup/occupations"
                  placeholder="Search occupation…"
                />
              </FieldRow>
              <FieldRow label="Occupation level">
                <SelectInput
                  value={data.occupationLevel}
                  onChange={(v) => set("occupationLevel", v)}
                  options={["SENIOR MANAGEMENT","MANAGEMENT","SUPERVISOR","SKILLED WORKER","SEMI-SKILLED WORKER","UNSKILLED WORKER","JUNIOR POSITION"]}
                />
              </FieldRow>
              <FieldRow label="Type of industry">
                <LookupSelect
                  value={data.industry}
                  onChange={(v) => set("industry", v)}
                  endpoint="/api/lookup/industries"
                  placeholder="Search industry…"
                />
              </FieldRow>
            </>
          )}
        </Section>

        <Section id="financial" title="Financial details">
          <CurrencyInput
            label="Gross monthly salary"
            value={data.confirmGross}
            onChange={(v) => set("confirmGross", v)}
          />
          {errorByField.confirmGross && <FieldErrorHint {...errorByField.confirmGross} />}
          <CurrencyInput
            label="Net Salary / Take-home Salary"
            value={data.confirmNet}
            onChange={(v) => set("confirmNet", v)}
          />
          {errorByField.confirmNet && <FieldErrorHint {...errorByField.confirmNet} />}
          {data.hasDeposit && (
            <CurrencyInput
              label="Deposit amount"
              value={data.confirmDeposit}
              onChange={(v) => set("confirmDeposit", v)}
            />
          )}
        </Section>

        <Section id="consents" title="Consents">
          <CheckboxRow
            checked={data.financialAccessConsent && data.dataAttestation}
            onChange={(v) => setData({ ...data, financialAccessConsent: v, dataAttestation: v })}
            label="I consent to Standard Bank collecting and processing my personal information, and to banks accessing my bank statements and payslip."
          />
          <CheckboxRow
            checked={data.marketingConsent}
            onChange={(v) => set("marketingConsent", v)}
            label="I agree to receive marketing communications (calls, email, SMS)."
          />
        </Section>
      </Accordion>

      <Button
        size="lg"
        className="w-full rounded-xl py-6 text-base font-semibold shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        disabled={submitting || !data.surname.trim()}
        onClick={onSubmit}
      >
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : "Submit Application"}
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={id} className="overflow-visible rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <span className="text-left text-sm font-semibold">{title}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-5 pb-5" style={{ overflow: "visible" }}>{children}</AccordionContent>
    </AccordionItem>
  );
}

function FieldRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CheckboxRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/40">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v: boolean | "indeterminate") => onChange(!!v)} />
      <span className="text-xs leading-snug">{label}</span>
    </label>
  );
}