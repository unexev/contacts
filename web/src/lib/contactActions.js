const DEFAULT_COUNTRY_CODE = '593';

function textOf(value, keys) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  return '';
}

// First active phone, otherwise the first one with a number.
export function primaryPhone(contact) {
  const phones = Array.isArray(contact?.phones) ? contact.phones : [];
  const numbers = phones.map((p) => ({ number: textOf(p, ['phone', 'number', 'value']), active: p?.is_active !== false }));
  const found = numbers.find((p) => p.number && p.active) || numbers.find((p) => p.number);
  // The list endpoint sends only primary_phone; the detail endpoint sends the full array.
  return found ? found.number : textOf(contact?.primary_phone, []);
}

export function primaryEmail(contact) {
  const emails = Array.isArray(contact?.emails) ? contact.emails : [];
  for (const e of emails) {
    const address = textOf(e, ['email', 'address', 'value']);
    if (address) return address;
  }
  return textOf(contact?.primary_email, []);
}

export function telHref(raw) {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

// Digits with country code for wa.me. Local numbers (leading 0 or 9 digits)
// get the default country code; anything shorter than 8 digits is rejected.
export function whatsappNumber(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  const text = String(raw || '').trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return '';
  if (text.startsWith('+')) return digits.length >= 8 ? digits : '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 8) { /* already international */ }
  else if (digits.startsWith('0')) digits = countryCode + digits.slice(1);
  else if (digits.length === 9) digits = countryCode + digits;
  return digits.length >= 8 ? digits : '';
}

export function whatsappHref(raw, countryCode) {
  const number = whatsappNumber(raw, countryCode);
  return number ? `https://wa.me/${number}` : '';
}

export function mailHref(address) {
  const value = String(address || '').trim();
  return value ? `mailto:${value}` : '';
}
