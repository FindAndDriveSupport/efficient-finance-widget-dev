import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onDone: () => void;
  onClose?: () => void;
}

const TIPS: Array<{ title: string; body: string }> = [
  { title: "Increase your income", body: "More earnings or disposable income boost affordability" },
  { title: "Lower your expenses", body: "Cut non-essentials to free up cash" },
  { title: "Pay off debt", body: "Less debt improves your chances" },
  { title: "Keep a healthy credit record", body: "Pay on time, avoid new debt" },
  { title: "Try again later", body: "You can reapply when ready" },
];

export function BelowMinimumPage({ onDone, onClose }: Props) {
  return (
    <div className="relative space-y-6">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-[var(--shadow-soft)] text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div>
        <h1 className="text-4xl font-bold leading-tight text-primary">Thanks for your interest!</h1>
        <p className="mt-4 text-sm font-medium leading-relaxed text-foreground">
          Based on your information, the amount you may qualify for is below the minimum loan value required for vehicle finance.
        </p>
      </div>

      <div className="rounded-3xl bg-primary/80 p-6 text-white shadow-[var(--shadow-elegant)]">
        <h2 className="text-lg font-semibold">Here's how you can improve:</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed">
          {TIPS.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold">{i + 1}.</span>
              <span>
                <span className="font-semibold">{t.title}</span> – {t.body}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Button
        size="lg"
        variant="outline"
        className="w-full rounded-xl bg-card py-6 text-base font-semibold text-primary shadow-[var(--shadow-soft)]"
        onClick={onDone}
      >
        Done
      </Button>
    </div>
  );
}
