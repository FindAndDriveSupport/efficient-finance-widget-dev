import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  message: string;
  action?: string;
}

export function EdithErrorBanner({ title, message, action }: Props) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-destructive/90">{message}</p>
          {action && <p className="text-xs text-destructive/80">{action}</p>}
        </div>
      </div>
    </div>
  );
}
