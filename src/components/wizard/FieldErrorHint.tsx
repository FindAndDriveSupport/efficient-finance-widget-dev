import { AlertCircle } from "lucide-react";

interface Props {
  title?: string;
  message?: string;
  action?: string;
}

export function FieldErrorHint({ title, message, action }: Props) {
  if (!title && !message && !action) return null;
  return (
    <div className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
      <div className="flex items-start gap-1.5">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          {title && <p className="font-medium">{title}</p>}
          {message && <p className="text-destructive/90">{message}</p>}
          {action && <p className="mt-0.5 text-destructive/70">{action}</p>}
        </div>
      </div>
    </div>
  );
}
