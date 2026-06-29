import { ChevronLeft } from "lucide-react";

interface Props {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function StepHeader({ step, total, title, subtitle, onBack }: Props) {
  const pct = (step / total) * 100;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="-ml-2 rounded-full p-2 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          Step {step} of {total}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }}
        />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
