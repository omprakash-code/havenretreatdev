export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

export function isValidPhone(value: string) {
  return /^\d{10}$/.test(value) && !/^0+$/.test(value);
}
