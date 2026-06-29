import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StepHeader } from "./StepHeader";
import { TypingInput } from "./TypingInput";
import { FileUpload, type UploadedFile } from "./FileUpload";
import type { WizardData } from "./types";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEmbed } from "@/contexts/EmbedContext";
import { useDealer } from "@/contexts/DealerContext";
import { workerApi } from "@/lib/worker";
import { buildEdithPayload } from "./edithPayload";
import { trackStep3SubmitApplication, trackStep3SubmitApplicationResult } from "@/lib/mixpanel";

interface Props {
  data: WizardData;
  setData: (d: WizardData) => void;
  back: () => void;
  onSwitchToManual: () => void;
  onComplete?: () => void;
}

export function Step3Fast({ data, setData, back, onSwitchToManual, onComplete }: Props) {
  const embed = useEmbed();
  const dealer = useDealer();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ policyNumber?: string; salesRef?: string } | null>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [selectedBranchCode, setSelectedBranchCode] = useState<string>(
    dealer.branches?.[0]?.code ?? dealer.branchCode
  );

  const [idDoc, setIdDoc] = useState<UploadedFile[]>([]);
  const [bankStatements, setBankStatements] = useState<UploadedFile[]>([]);
  const [salarySlips, setSalarySlips] = useState<UploadedFile[]>([]);
  const [proofOfResidence, setProofOfResidence] = useState<UploadedFile[]>([]);

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setData({ ...data, [k]: v });

  const onSubmit = async () => {
    setVehicleError(null);
    setDocsError(null);

    if (!data.dealership?.trim() || !data.vehicleMake?.trim() || !data.vehicleModel?.trim()) {
      setVehicleError("Dealership, vehicle make and vehicle model are required.");
      toast.error("Please complete the vehicle & dealership details.");
      return;
    }

    if (
      idDoc.length === 0 ||
      bankStatements.length === 0 ||
      salarySlips.length === 0 ||
      proofOfResidence.length === 0
    ) {
      setDocsError("Please upload all required documents.");
      toast.error("All documents are required.");
      return;
    }

    trackStep3SubmitApplication();
    setSubmitting(true);

    try {
      const payload = buildEdithPayload(data, selectedBranchCode);
      const res = await workerApi.createPolicy(payload, dealer.key !== "default" ? dealer.key : embed.dealer);

      const policyNumber = res.policyNumber;
      const isSuccess = (res.code === 100 || res.code === 200 || res.StatusCode === 100) && !!policyNumber;

      if (!isSuccess || !policyNumber) {
        trackStep3SubmitApplicationResult(false, { fast: true, reason: "createPolicy failed" });
        toast.error("Could not create application. Please try again or use the full form.");
        setSubmitting(false);
        return;
      }

      const documents = [
        ...idDoc.map((f) => ({
          category: data.idType === "Passport" ? "PASSPORT" : "ID DOCUMENT - CLIENT",
          description: f.name,
          base64: f.base64,
          fileExtension: f.fileExtension,
        })),
        ...bankStatements.map((f) => ({
          category: "BANK STATEMENT",
          description: f.name,
          base64: f.base64,
          fileExtension: f.fileExtension,
        })),
        ...salarySlips.map((f) => ({
          category: "SALARY SLIP",
          description: f.name,
          base64: f.base64,
          fileExtension: f.fileExtension,
        })),
        ...proofOfResidence.map((f) => ({
          category: "PROOF OF RESIDENCE",
          description: f.name,
          base64: f.base64,
          fileExtension: f.fileExtension,
        })),
      ];

      const docsRes = await workerApi.submitDocuments(
        { policyNumber, salesRef: res.salesRef, documents },
        dealer.key !== "default" ? dealer.key : embed.dealer
      );

      setSubmitted({ policyNumber, salesRef: res.salesRef });
      onComplete?.();

      if (docsRes.success) {
        trackStep3SubmitApplicationResult(true, { fast: true, policyNumber, salesRef: res.salesRef });
        toast.success("Application submitted");
      } else {
        trackStep3SubmitApplicationResult(true, {
          fast: true,
          policyNumber,
          salesRef: res.salesRef,
          documentsFailed: true,
        });
        toast.warning("Application submitted, but documents could not be attached. Our team will follow up.");
      }
    } catch (err) {
      console.error(err);
      trackStep3SubmitApplicationResult(false, { fast: true, networkError: true });
      toast.error("Unable to connect. Please try again.");
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
      <StepHeader step={3} total={3} title="Fast application" subtitle="Upload your documents and we'll handle the rest." onBack={back} />

      <button
        type="button"
        onClick={onSwitchToManual}
        className="w-full rounded-xl border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60"
      >
        Prefer to fill out the full form yourself?{" "}
        <span className="font-semibold text-foreground underline">Switch to full application</span>
      </button>

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

      {/* Vehicle & Dealership */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-semibold">Vehicle & dealership</h3>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Dealership <span className="text-destructive">*</span>
          </Label>
          <TypingInput
            value={data.dealership ?? ""}
            onChange={(v) => set("dealership", v)}
            phrases={["Search dealership…", "e.g. Standard Bank Motors", "Start typing to search…"]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Vehicle make <span className="text-destructive">*</span>
            </Label>
            <TypingInput
              value={data.vehicleMake ?? ""}
              onChange={(v) => set("vehicleMake", v)}
              phrases={["e.g. Toyota", "e.g. Volkswagen", "e.g. Ford"]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Vehicle model <span className="text-destructive">*</span>
            </Label>
            <TypingInput
              value={data.vehicleModel ?? ""}
              onChange={(v) => set("vehicleModel", v)}
              phrases={["e.g. Corolla", "e.g. Polo", "e.g. Ranger"]}
            />
          </div>
        </div>

        {vehicleError && <p className="text-xs text-destructive">⚠ {vehicleError}</p>}
      </div>

      {/* Documents */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-semibold">Required documents</h3>
        <p className="text-xs text-muted-foreground">
          Please upload clear copies or photos of the following documents.
        </p>

        <FileUpload
          label={`Copy of ${data.idType === "Passport" ? "Passport" : "ID Document"} *`}
          files={idDoc}
          onChange={setIdDoc}
        />
        <FileUpload
          label="3 Months Bank Statements *"
          hint="Upload your most recent 3 months of bank statements"
          multiple
          files={bankStatements}
          onChange={setBankStatements}
        />
        <FileUpload
          label="3 Months Salary Slips *"
          hint="Upload your most recent 3 months of payslips"
          multiple
          files={salarySlips}
          onChange={setSalarySlips}
        />
        <FileUpload
          label="Proof of Residence *"
          hint="Not older than 3 months (utility bill, bank statement, etc.)"
          files={proofOfResidence}
          onChange={setProofOfResidence}
        />

        {docsError && <p className="text-xs text-destructive">⚠ {docsError}</p>}
      </div>

      <Button
        size="lg"
        className="w-full rounded-xl py-6 text-base font-semibold shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        disabled={submitting}
        onClick={onSubmit}
      >
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : "Submit Application"}
      </Button>
    </div>
  );
}