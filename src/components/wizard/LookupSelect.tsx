import { useState, useEffect, useRef } from "react";

const WORKER = import.meta.env.VITE_WORKER_URL as string | undefined;

interface Props {
  value: string;
  onChange: (v: string) => void;
  endpoint: string;
  placeholder?: string;
}

export function LookupSelect({ value, onChange, endpoint, placeholder = "Search..." }: Props) {
  const [allOptions, setAllOptions] = useState<string[]>([]);
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Load all options once on mount
  useEffect(() => {
    if (!WORKER) return;
    fetch(`${WORKER}${endpoint}?q=`)
      .then((r) => r.json())
      .then((data) => {
        setAllOptions((data.results || []).map((r: { name: string }) => r.name));
      })
      .catch(() => setAllOptions([]))
      .finally(() => setLoading(false));
  }, [endpoint]);

  // Sync search input when value changes externally
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // If user typed something that doesn't match, reset to last valid value
        if (!allOptions.includes(search)) {
          setSearch(value || "");
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [search, value, allOptions]);

  const filtered = search.trim()
    ? allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : allOptions;

  const onSelect = (option: string) => {
    onChange(option);
    setSearch(option);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? "Loading..." : placeholder}
        disabled={loading}
        autoComplete="off"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md">
          {filtered.map((option) => (
            <li
              key={option}
              onMouseDown={() => onSelect(option)}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-muted ${
                option === value ? "bg-muted font-medium" : ""
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      {open && !loading && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-md">
          No results found
        </div>
      )}
    </div>
  );
}
