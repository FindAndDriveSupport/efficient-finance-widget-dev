const WORKER = (window as any).__VITE_WORKER_URL__ ?? import.meta.env?.VITE_WORKER_URL ?? "";

interface AddressFields {
  township?: string;
  city?: string;
  postalCode?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

async function fieldHasMatch(value: string | undefined): Promise<boolean> {
  if (!value || value.trim().length < 2) return false;
  if (!WORKER) return true;
  try {
    const res = await fetch(
      `${WORKER}/api/address-search?q=${encodeURIComponent(value.trim())}&limit=1`
    );
    if (!res.ok) return false;
    const json = await res.json();
    const results: unknown[] = Array.isArray(json) ? json : (json.results ?? []);
    return results.length > 0;
  } catch {
    return false;
  }
}

export async function validateAddressFields(
  fields: AddressFields
): Promise<ValidationResult> {
  const [townshipMatch, cityMatch, postalMatch] = await Promise.all([
    fieldHasMatch(fields.township),
    fieldHasMatch(fields.city),
    fieldHasMatch(fields.postalCode),
  ]);

  if (townshipMatch || cityMatch || postalMatch) {
    return { valid: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  if (fields.township)   errors.township   = "Suburb not found. Try updating the city or postal code.";
  if (fields.city)       errors.city       = "City not found. Try updating the suburb or postal code.";
  if (fields.postalCode) errors.postalCode = "Postal code not found. Try updating the suburb or city.";

  if (Object.keys(errors).length === 0) return { valid: true, errors: {} };
  return { valid: false, errors };
}
