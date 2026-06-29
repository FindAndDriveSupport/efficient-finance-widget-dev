import { Label } from "@/components/ui/label";
import { formatThousands, parseThousands } from "./validation";

interface Props {
  label?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  max?: number;
  id?: string;
}

/**
 * Currency input with a static "R" prefix element.
 * The "R" is NOT part of the value — it's a styled adornment.
 * Thousands separators are rendered with non-breaking spaces.
 */
export function CurrencyInput({ label, value, onChange, placeholder = "0", max, id }: Props) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
        <span
          aria-hidden="true"
          className="flex select-none items-center border-r border-input bg-muted px-3 text-base font-semibold text-foreground"
        >
          R
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={formatThousands(value)}
          onChange={(e) => {
            const n = parseThousands(e.target.value);
            if (max != null && n !== "" && n > max) {
              return;
            }
            onChange(n);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
