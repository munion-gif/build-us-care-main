export function maskName(name?: string | null) {
  const value = name?.trim();
  if (!value) return "-";
  if (value.length === 1) return `${value}*`;
  return `${value.slice(0, 1)}${"*".repeat(Math.min(Math.max(value.length - 1, 1), 3))}`;
}

export function maskPhone(phone?: string | null) {
  const value = phone?.trim();
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  const middleEnd = digits.length >= 11 ? 7 : Math.max(digits.length - 4, 4);
  return `${digits.slice(0, 3)}-${digits.slice(3, middleEnd)}-****`;
}

export function maskAddress(address?: string | null, visibleTokens = 3) {
  const value = address?.trim();
  if (!value) return "-";
  const visible = value.split(/\s+/).filter(Boolean).slice(0, visibleTokens).join(" ");
  return visible ? `${visible} ***` : "***";
}
