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

export function calculateAgeParts(value, today = new Date()) {
  const birthdate = parseContactDate(value);
  if (!birthdate) return null;

  let years = today.getFullYear() - birthdate.getFullYear();
  let anchor = new Date(birthdate.getFullYear() + years, birthdate.getMonth(), birthdate.getDate());
  if (anchor > today) {
    years--;
    anchor = new Date(birthdate.getFullYear() + years, birthdate.getMonth(), birthdate.getDate());
  }

  let months = 0;
  let cursor = new Date(anchor);
  while (months < 12) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    if (next > today) break;
    cursor = next;
    months++;
  }

  const start = Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((end - start) / 86400000);
  return { years, months, days };
}

export function formatAge(value) {
  return formatAgeAt(value, new Date());
}

export function formatAgeAt(value, target) {
  const date = target instanceof Date ? target : parseContactDate(target);
  if (!date) return null;
  const age = calculateAgeParts(value, date);
  if (!age) return null;
  const parts = [];
  if (age.years) parts.push(`${age.years} ${age.years === 1 ? 'año' : 'años'}`);
  if (age.months) parts.push(`${age.months} ${age.months === 1 ? 'mes' : 'meses'}`);
  if (age.days || parts.length === 0) parts.push(`${age.days} ${age.days === 1 ? 'día' : 'días'}`);
  return parts.join(', ');
}
