import { AlertCircle } from "lucide-react";

interface IDNotFoundPageProps {
  onRetry: () => void;
  onProceed: () => void;
}

export function IDNotFoundPage({ onRetry, onProceed }: IDNotFoundPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-10 text-center">
      <div
        className="flex items-center justify-center w-16 h-16 rounded-full mb-6"
        style={{ background: "var(--gradient-primary)" }}
      >
        <AlertCircle className="w-8 h-8 text-white" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-3">
        No credit bureau information found
      </h2>

      <p className="text-sm text-muted-foreground max-w-xs mb-8">
        We couldn't find any credit profile linked to your ID number. This happens when there is no credit activity.
      </p>

      <button
        onClick={onRetry}
        className="w-full max-w-xs rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] mb-3"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        Try a different ID number
      </button>

      <button
        onClick={onProceed}
        className="w-full max-w-xs rounded-xl px-6 py-3 text-sm font-semibold border border-border bg-background text-foreground hover:bg-muted"
      >
        Continue to application
      </button>
    </div>
  );
}
