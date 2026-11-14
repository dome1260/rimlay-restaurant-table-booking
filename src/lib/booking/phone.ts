// OQ-10: Thai mobile only, 10 digits starting 06 / 08 / 09. Dashes and spaces are stripped
// before saving because the number is the lookup key and the one-booking-per-day key.
export const PHONE_PATTERN = /^0[689]\d{8}$/;

export function normalizePhone(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function isValidPhone(input: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(input));
}

export function formatPhone(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}` : phone;
}
