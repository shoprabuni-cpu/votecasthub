export function normalizeGhanaPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^0\d{9}$/.test(compact)) return `+233${compact.slice(1)}`;
  if (/^233\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}
