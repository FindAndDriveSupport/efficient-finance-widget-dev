import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { QualificationBanner } from "./QualificationBanner";
import { StepHeader } from "./StepHeader";
import { CurrencyInput } from "./CurrencyInput";
import type { WizardData } from "./types";
import { validateMobile } from "./validation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  usePageTimer,
  trackHomePageLoad,
  trackStep1Continue,
  trackStep1DepositClicked,
  trackStep1CurrentFinanceClicked,
} from "@/lib/mixpanel";
import { workerApi } from "@/lib/worker";
import { useEmbed } from "@/contexts/EmbedContext";
import { toast } from "sonner";

interface Props {
  data: WizardData;
  setData: (d: WizardData) => void;
  next: () => void;
}

export function Step1({ data, setData, next }: Props) {
  usePageTimer("Step 1 - Personal Details");
  useEffect(() => { trackHomePageLoad(); }, []);
  const embed = useEmbed();
  const [submitting, setSubmitting] = useState(false);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setInitialising(false), 800);
    return () => clearTimeout(t);
  }, []);

  const u = (patch: Partial<WizardData>) => setData({ ...data, ...patch });
  const mobile = validateMobile(data.mobile);
  const mobileDigits = data.mobile.replace(/\D/g, "");

  const valid =
    data.name.trim() &&
    data.surname.trim() &&
    Number(data.netIncome) > 0 &&
    Number(data.netIncome) <= 300000 &&
    mobile.valid;

  const onContinue = async () => {
    trackStep1Continue();
    setSubmitting(true);
    try {
      const res = await workerApi.preQualify(data, embed.dealer);
      setData({
        ...data,
        applicantId: res.applicantId,
        preQualMonthly: res.monthlyAmount,
        preQualTotal: res.totalAmount,
      });
      next();
    } catch (e) {
      console.error(e);
      toast.error("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (initialising) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{ color: "var(--dealer-primary, var(--primary))" }}
        />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader step={1} total={3} title="Let's get to know you" subtitle="A few quick details to estimate what you qualify for." />
      <QualificationBanner monthlyAmount={0} totalAmount={0} showToggle={false} />

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={data.name} onChange={(e) => u({ name: e.target.value })} placeholder="John" />
          </Field>
          <Field label="Surname">
            <Input value={data.surname} onChange={(e) => u({ surname: e.target.value })} placeholder="Doe" />
          </Field>
        </div>

        <CurrencyInput
          label="Net Salary / Take-home Salary (monthly)"
          value={data.netIncome}
          max={300000}
          onChange={(v) => u({ netIncome: v })}
        />

        <Field label="Mobile number">
          <Input
            type="tel"
            inputMode="numeric"
            maxLength={12}
            value={data.mobile}
            onChange={(e) => u({ mobile: e.target.value.replace(/[^\d\s]/g, "") })}
            placeholder="082 123 4567"
          />
          {mobileDigits.length > 0 && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${mobile.valid ? "text-emerald-600" : "text-destructive"}`}>
              {mobile.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {mobile.message}
            </p>
          )}
        </Field>

        <div className="space-y-3 rounded-xl bg-muted/40 p-3">
          <label className="flex items-center gap-3">
            <Checkbox
              checked={data.hasDeposit}
              onCheckedChange={(v: boolean | "indeterminate") => {
                const checked = !!v;
                trackStep1DepositClicked(checked);
                u({ hasDeposit: checked });
              }}
            />
            <span className="text-sm font-medium">I have a deposit</span>
          </label>
          {data.hasDeposit && (
            <CurrencyInput value={data.depositAmount} onChange={(v) => u({ depositAmount: v })} placeholder="Deposit amount" />
          )}

          <label className="flex items-center gap-3">
            <Checkbox
              checked={data.hasFinance}
              onCheckedChange={(v: boolean | "indeterminate") => {
                const checked = !!v;
                trackStep1CurrentFinanceClicked(checked);
                u({ hasFinance: checked });
              }}
            />
            <span className="text-sm font-medium">I currently have finance (trade-in)</span>
          </label>
          {data.hasFinance && (
            <CurrencyInput value={data.financeAmount} onChange={(v) => u({ financeAmount: v })} placeholder="Current monthly instalment" />
          )}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full rounded-xl py-6 text-base font-semibold shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        disabled={!valid || submitting}
        onClick={onContinue}
      >
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</> : "Continue"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
