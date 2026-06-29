export function repeatedDigits(number: string) {
  const digits = number.replace(/\D/g, "");
  // All same digits e.g. 0000000000
  if (/^(\d)\1+$/.test(digits)) return true;
  // 6 or more consecutive same digits e.g. 0738888888
  if (/(\d)\1{5,}/.test(digits)) return true;
  // Valid prefix followed by 6+ zeros e.g. 0700000001
  if (/^0\d{2}0{6,}/.test(digits)) return true;
  return false;
}

const fakePatterns = ["0123456789", "1234567890", "0987654321", "9876543210"];

export function sequential(number: string) {
  const digits = number.replace(/\D/g, "");
  if (fakePatterns.some((p) => digits.includes(p))) return true;
  // Incremental patterns in the subscriber portion e.g. 0821234567
  if (/0123|1234|2345|3456|4567|5678|6789/.test(digits.slice(3))) return true;
  return false;
}

const validPrefixes = [
  "060", "061", "062", "063", "064", "065", "066", "067", "068", "069",
  "071", "072", "073", "074", "076", "077", "078", "079",
  "081", "082", "083", "084",
];

export function validPrefix(number: string) {
  const local = number.replace(/\D/g, "").slice(-10);
  return validPrefixes.includes(local.substring(0, 3));
}

export type MobileStatus = { valid: boolean; message: string };

export function validateMobile(number: string): MobileStatus {
  const digits = number.replace(/\D/g, "");
  if (digits.length === 0) return { valid: false, message: "" };
  if (digits.length < 10) return { valid: false, message: "10 digits required" };
  if (digits.length > 10) return { valid: false, message: "Mobile number must be 10 digits" };
  if (repeatedDigits(digits)) return { valid: false, message: "Mobile number looks invalid" };
  if (sequential(digits)) return { valid: false, message: "Mobile number looks invalid" };
  if (!validPrefix(digits)) return { valid: false, message: "Invalid SA mobile prefix" };
  return { valid: true, message: "Mobile number is valid" };
}

/** Format a number string with spaces every 3 digits from the right. */
export function formatThousands(value: number | string): string {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseThousands(value: string): number | "" {
  const digits = value.replace(/\D/g, "");
  return digits === "" ? "" : Number(digits);
}

/**
 * South African ID number validation. Returns null when valid, else a
 * user-facing error message.
 */
export function validateSAID(id: string): string | null {
  if (!id || id.length !== 13) return "ID number must be exactly 13 digits.";
  if (!/^\d{13}$/.test(id)) return "ID number must contain digits only.";
  if (/^(\d)\1+$/.test(id)) return "Please enter a valid ID number.";

  const yy = parseInt(id.substring(0, 2), 10);
  const mm = parseInt(id.substring(2, 4), 10);
  const dd = parseInt(id.substring(4, 6), 10);
  const currentYear = new Date().getFullYear();
  const fullYear = yy <= currentYear % 100 ? 2000 + yy : 1900 + yy;

  // Future date check
  if (fullYear > currentYear) return "ID number contains an invalid date of birth.";

  const date = new Date(fullYear, mm - 1, dd);
  const dateValid =
    date.getFullYear() === fullYear &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd;
  if (!dateValid) return "ID number contains an invalid date of birth.";

  // Age checks
  const age = currentYear - fullYear;
  if (age < 18) return "You must be 18 or older to apply.";
  if (age > 80) return "Please check your ID number.";

  // Luhn check
  let sumOdd = 0;
  for (let i = 0; i < 12; i += 2) sumOdd += parseInt(id[i], 10);
  let evenDigits = "";
  for (let i = 1; i < 12; i += 2) evenDigits += id[i];
  const doubled = (parseInt(evenDigits, 10) * 2).toString();
  const sumEven = doubled.split("").reduce((a, b) => a + parseInt(b, 10), 0);
  const checkDigit = (10 - ((sumOdd + sumEven) % 10)) % 10;
  if (checkDigit !== parseInt(id[12], 10)) {
    return "ID number is not valid. Please check it matches your ID document exactly.";
  }
  return null;
}
