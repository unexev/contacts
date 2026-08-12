export function parseContactDate(value) {
  if (!value) return null;
  const raw = typeof value === 'object' ? (value.String || value.time || '') : String(value);
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = match
    ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateAge(value) {
  const birthdate = parseContactDate(value);
  if (!birthdate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  if (today.getMonth() < birthdate.getMonth() || (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate())) age--;
  return age;
}
