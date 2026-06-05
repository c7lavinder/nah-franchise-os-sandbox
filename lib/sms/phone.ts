export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function toSignalHousePhone(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export function phoneLookupKey(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
