import { CheckCircle2, Sparkles, TrendingUp, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { AffordabilityCard } from "./AffordabilityCard";

export type ResponseTier = "in_progress" | "good" | "great";

const CONSENTS = [
  "I give consent to my application being sent to one or more financial institutions.",
  "I give consent to the credit bureau to process my credit information including income, employment, personal data for prescribed business as per related Acts and that such outcome may be shared with the 3rd Party.",
  "I am currently NOT liable as a guarantor.",
  "I am currently NOT liable as a surety.",
  "I am currently NOT liable as a co-debtor.",
  "By proceeding with this vehicle finance application, your credit score may be affected.",
];

const COPY: Record<ResponseTier, { title: string; sub: string; body: string; accent: string }> = {
  in_progress: {
    title: "In progress",
    sub: "Let's move forward with your application!",
    body: "We'll contact you to guide you through the next steps and explore the best options together.",
    accent: "from-warning/90 to-warning",
  },
  good: {
    title: "Good News!",
    sub: "Your credit rating is solid.",
    body: "While approval may depend on additional factors, we're confident we can work with you to find the best financing options.",
    accent: "from-primary to-primary-glow",
  },
  great: {
    title: "Great News!",
    sub: "Your credit rating is excellent.",
    body: "You are highly likely to be approved for financing. We're excited to help you find the perfect vehicle!",
    accent: "from-success to-primary-glow",
  },
};

interface Props {
  tier: ResponseTier;
  reason: string;
  estimatedApprovalAmount: number;
  monthlyInstalment: number;
  consents: boolean[];
  setConsents: (c: boolean[]) => void;
  next: () => void;
}

export function ResponsePage({ tier, reason, estimatedApprovalAmount, monthlyInstalment, consents, setConsents, next }: Props) {
  const copy = COPY[tier];
  const [agreed, setAgreed] = useState(consents);
  const valid = agreed.every(Boolean);
  const Icon = tier === "great" ? Sparkles : tier === "good" ? CheckCircle2 : TrendingUp;

  const toggle = (i: number) => {
    const c = [...agreed];
    c[i] = !c[i];
    setAgreed(c);
    setConsents(c);
  };

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${copy.accent} p-6 text-white shadow-[var(--shadow-elegant)]`}>
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <Icon className="h-10 w-10" />
        <h2 className="mt-3 text-3xl font-bold tracking-tight">{copy.title}</h2>
        <p className="mt-1 text-sm font-medium opacity-95">{copy.sub}</p>
        <p className="mt-4 text-sm leading-relaxed opacity-90">{copy.body}</p>
      </div>

      <div className="rounded-2xl border border-border bg-accent/40 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tip</p>
            <p className="mt-1 text-sm text-foreground">{reason}</p>
          </div>
        </div>
      </div>

      <AffordabilityCard estimatedApprovalAmount={estimatedApprovalAmount} monthlyInstalment={monthlyInstalment} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold">Consent & Declarations</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Please read the consents and declarations below and select each checkbox if you give consent or agree.
        </p>
        <div className="mt-4 space-y-3">
          {CONSENTS.map((c, i) => (
            <label key={i} className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/40">
              <Checkbox className="mt-0.5" checked={agreed[i]} onCheckedChange={() => toggle(i)} />
              <span className="text-xs leading-snug text-foreground">{c}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full rounded-xl py-6 text-base font-semibold shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        disabled={!valid}
        onClick={next}
      >
        Submit Application
      </Button>
    </div>
  );
}
