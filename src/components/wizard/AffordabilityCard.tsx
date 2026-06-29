import { formatRand } from "@/lib/formatters";

interface Props {
  estimatedApprovalAmount: number;
  monthlyInstalment: number;
}

export function AffordabilityCard({ estimatedApprovalAmount, monthlyInstalment }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-base font-semibold text-foreground">Affordability</h3>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Estimated approval amount</span>
        <span className="text-sm font-semibold text-foreground">{formatRand(estimatedApprovalAmount)}</span>
      </div>
      <div className="my-3 h-px bg-border" />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Monthly instalment</span>
        <span className="text-sm font-semibold text-primary">{formatRand(monthlyInstalment)} /pm</span>
      </div>
    </div>
  );
}
