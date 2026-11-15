// Phone labels are stored as plain text (shared with the native client, which
// shows them as-is), so the stored value is the Spanish word and only the
// option text is translated.
export const PHONE_LABELS = [
  { value: 'Personal', label: 'phoneLabelPersonal' },
  { value: 'Trabajo', label: 'phoneLabelWork' },
  { value: 'Casa', label: 'phoneLabelHome' },
  { value: 'Otro', label: 'phoneLabelOther' }
];

export const DEFAULT_PHONE_LABEL = 'Personal';

function findPhoneLabel(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  return PHONE_LABELS.find(option => option.value.toLowerCase() === key) || null;
}

// Maps a stored label onto its option value ("personal" -> "Personal");
// labels outside the list (typed before the menu existed) are kept as-is.
export function normalizePhoneLabel(raw) {
  const text = String(raw ?? '').trim();
  return findPhoneLabel(text)?.value ?? text;
}

export function resolvePhoneLabel(raw, t) {
  const option = findPhoneLabel(raw);
  return option ? t(option.label) : String(raw ?? '').trim();
}
