/** Format a number as South African Rand with space thousand separators. */
export function formatRand(amount: number): string {
  if (!Number.isFinite(amount)) return "R0";
  return "R" + Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ");
}
