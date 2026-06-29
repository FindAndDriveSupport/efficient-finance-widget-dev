import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmbed } from "@/contexts/EmbedContext";

export interface PostalLocation {
  id: number;
  suburb: string;
  city: string;
  postal_code: string;
  display_name: string;
}

interface Props {
  value: PostalLocation | null;
  onSelect: (loc: PostalLocation) => void;
  error?: string | null;
}

const WORKER = import.meta.env.VITE_WORKER_URL as string | undefined;

// Tiny mock dataset for Lovable preview when no Worker is configured.
const MOCK: PostalLocation[] = [
  { id: 1, suburb: "Parkwood", city: "Johannesburg", postal_code: "2193", display_name: "Parkwood, Johannesburg, 2193" },
  { id: 2, suburb: "Sandton", city: "Johannesburg", postal_code: "2196", display_name: "Sandton, Johannesburg, 2196" },
  { id: 3, suburb: "Sea Point", city: "Cape Town", postal_code: "8005", display_name: "Sea Point, Cape Town, 8005" },
  { id: 4, suburb: "Umhlanga", city: "Durban", postal_code: "4319", display_name: "Umhlanga, Durban, 4319" },
  { id: 5, suburb: "Hatfield", city: "Pretoria", postal_code: "0083", display_name: "Hatfield, Pretoria, 0083" },
  { id: 6, suburb: "Rosebank", city: "Johannesburg", postal_code: "2196", display_name: "Rosebank, Johannesburg, 2196" },
  { id: 7, suburb: "Claremont", city: "Cape Town", postal_code: "7708", display_name: "Claremont, Cape Town, 7708" },
];

export function AddressLookup({ value, onSelect, error }: Props) {
  const embed = useEmbed();
  const [query, setQuery] = useState(value?.display_name ?? "");
  const [results, setResults] = useState<PostalLocation[]>([]);
  const [open, setOpen] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (value) setQuery(value.display_name);
  }, [value]);

  async function search(v: string) {
    setQuery(v);
    if (v.length < 2) { setResults([]); setOpen(false); return; }

    if (!WORKER) {
      const q = v.toLowerCase();
      setResults(MOCK.filter((m) =>
        m.suburb.toLowerCase().startsWith(q) ||
        m.city.toLowerCase().startsWith(q) ||
        m.postal_code.startsWith(v)
      ).slice(0, 15));
      setOpen(true);
      return;
    }

    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const res = await fetch(`${WORKER}/api/address-search?q=${encodeURIComponent(v)}`, {
        headers: { "X-Dealer-Key": embed.dealer ?? "" },
        signal: ctrl.signal,
      });
      const json = await res.json();
      // addressSearch worker returns { results: [...] } — normalise to array
      const locations: PostalLocation[] = Array.isArray(json)
        ? json
        : (json.results ?? []);
      setResults(locations);
      setOpen(true);
    } catch {
      /* aborted or network error — ignore */
    }
  }

  function pick(loc: PostalLocation) {
    onSelect(loc);
    setQuery(loc.display_name);
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Suburb / City / Postal Code</Label>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search suburb, city or postal code"
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      {value && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Input readOnly value={value.suburb} className="bg-muted text-xs" placeholder="Suburb" />
          <Input readOnly value={value.city} className="bg-muted text-xs" placeholder="City" />
          <Input readOnly value={value.postal_code} className="bg-muted text-xs" placeholder="Postal code" />
        </div>
      )}
      {error && <p className="text-xs text-destructive">⚠ {error}</p>}
    </div>
  );
}