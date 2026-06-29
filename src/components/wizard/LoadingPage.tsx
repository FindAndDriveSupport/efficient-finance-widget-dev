import { useEffect, useState } from "react";
import experianLogo from "@/assets/experian_idfKXIhI6C_0.png";

const STEPS = [
  "Fetching your affordability information…",
  "Fetching your credit profile…",
  "Running soft credit check…",
  "Finalising results…",
];

type LoadingPhase = "loading" | "retrying" | "failed";

interface LoadingPageProps {
  onDone: () => void;
  onFailed: () => void;
  onProceed: () => void;
  attempt?: number; // 0 = first attempt, 1 = retrying, 2+ = failed
}

export function LoadingPage({ onDone, onFailed, onProceed, attempt = 0 }: LoadingPageProps) {
  const [i, setI] = useState(0);
  const initialPhase: LoadingPhase = attempt === 0 ? "loading" : attempt === 1 ? "retrying" : "failed";
  const [phase, setPhase] = useState<LoadingPhase>(initialPhase);

  // Step through loading steps then call onDone — only on first attempt
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => setI((p) => {
      if (p >= STEPS.length) return p;
      return p + 1;
    }), 900);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    if (i >= STEPS.length) {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
  }, [i, onDone, phase]);

  // On retrying phase — auto-trigger retry after brief delay
  useEffect(() => {
    if (phase !== "retrying") return;
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase === "retrying") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ backgroundImage: "var(--gradient-primary)" }} />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elegant)]"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold">Trying again…</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          We didn't retrieve any information from the credit bureau so we're trying again.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          A soft credit check does not affect your credit score.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Credit bureau partner</span>
          <img src={experianLogo} alt="Experian" className="h-8" />
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <span className="text-3xl">✕</span>
        </div>
        <h2 className="text-xl font-bold">Credit check unsuccessful</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          We were unable to retrieve your credit information. Please check that your ID number is correct and try again.
        </p>
        <button
          onClick={onFailed}
          className="mt-6 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          Check my ID and try again
        </button>
        <button
          onClick={onProceed}
          className="mt-3 rounded-xl px-6 py-3 text-sm font-semibold border border-border bg-background text-foreground hover:bg-muted"
        >
          Continue to application
        </button>
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Credit bureau partner</span>
          <img src={experianLogo} alt="Experian" className="h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ backgroundImage: "var(--gradient-primary)" }} />
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elegant)]"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      </div>
      <h2 className="text-xl font-bold">Just a moment…</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        A soft credit check does not affect your credit score.
      </p>

      <div className="mt-6 w-full max-w-sm space-y-2">
        {STEPS.map((s, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm transition-all ${
              idx < i ? "opacity-100" : idx === i ? "opacity-100" : "opacity-40"
            }`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                idx < i ? "bg-success text-white" : idx === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {idx < i ? "✓" : idx + 1}
            </div>
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Credit bureau partner</span>
        <img src={experianLogo} alt="Experian" className="h-8" />
      </div>
    </div>
  );
}
