import { useEffect, useState } from "react";

const PHRASES_DEFAULT = ["Searching dealers…", "Loading suggestions…"];

export function TypingInput({
  value,
  onChange,
  phrases,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  phrases?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const list = phrases && phrases.length ? phrases : PHRASES_DEFAULT;
  const [placeholder, setPlaceholder] = useState("");
  const [pIdx, setPIdx] = useState(0);
  const [cIdx, setCIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (value) return; // pause typing if user is typing
    const current = list[pIdx % list.length];
    const speed = deleting ? 40 : 80;
    const t = setTimeout(() => {
      if (!deleting) {
        const next = current.slice(0, cIdx + 1);
        setPlaceholder(next);
        if (next === current) {
          setTimeout(() => setDeleting(true), 1200);
        } else {
          setCIdx(cIdx + 1);
        }
      } else {
        const next = current.slice(0, Math.max(0, cIdx - 1));
        setPlaceholder(next);
        if (next.length === 0) {
          setDeleting(false);
          setCIdx(0);
          setPIdx((p) => p + 1);
        } else {
          setCIdx(cIdx - 1);
        }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [cIdx, deleting, pIdx, list, value]);

  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={value ? "" : placeholder + "|"}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
