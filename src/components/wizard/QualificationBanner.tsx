import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { formatRand } from "@/lib/formatters";

interface Props {
  monthlyAmount: number;
  totalAmount: number;
  /** When false (Step 1), shows R0 /pm with no toggle and a "complete the form" subtext. */
  showToggle: boolean;
}

export function QualificationBanner({ monthlyAmount, totalAmount, showToggle }: Props) {
  const [monthly, setMonthly] = useState(true);
  const amount = showToggle ? (monthly ? monthlyAmount : totalAmount) : 0;
  const label = showToggle ? (monthly ? "/pm" : " total finance") : " /pm";

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-[var(--shadow-elegant)]"
      style={{ backgroundImage: "var(--gradient-primary)" }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <p className="text-xs uppercase tracking-wider opacity-80">You may qualify for</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">{formatRand(amount)}</span>
        <span className="text-sm opacity-90">{label}</span>
      </div>
      {showToggle && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={monthly ? "font-semibold" : "opacity-70"}>Monthly</span>
          <Switch checked={!monthly} onCheckedChange={(v) => setMonthly(!v)} />
          <span className={!monthly ? "font-semibold" : "opacity-70"}>Total</span>
        </div>
      )}
      <p className="mt-3 text-[12px] leading-snug opacity-90">
        Soft credit and affordability checks are required for accurate amounts. Terms and Conditions apply.
      </p>
    </div>
  );
}
