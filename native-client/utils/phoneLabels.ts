/**
 * Phone labels are stored as plain text shared with the web client, so the
 * stored value is the Spanish word and only what is shown is translated.
 * Labels outside the list (typed before the menu existed) are kept as-is.
 */
export const PHONE_LABELS = [
  { value: 'Personal', labelKey: 'phoneLabelPersonal' },
  { value: 'Trabajo', labelKey: 'phoneLabelWork' },
  { value: 'Casa', labelKey: 'phoneLabelHome' },
  { value: 'Otro', labelKey: 'phoneLabelOther' },
] as const;

export type PhoneLabelKey = (typeof PHONE_LABELS)[number]['labelKey'];

export const DEFAULT_PHONE_LABEL = 'Personal';

// Words found in vCards and older data that mean one of the options.
const ALIASES: Record<string, string> = {
  cell: 'Personal', mobile: 'Personal', celular: 'Personal', movil: 'Personal', móvil: 'Personal',
  work: 'Trabajo', office: 'Trabajo', oficina: 'Trabajo',
  home: 'Casa',
  other: 'Otro',
};

function findLabel(raw: string | null | undefined) {
  const key = String(raw ?? '').trim().toLowerCase();
  const canonical = PHONE_LABELS.find(o => o.value.toLowerCase() === key)?.value ?? ALIASES[key];
  return canonical ? PHONE_LABELS.find(o => o.value === canonical) ?? null : null;
}

/** "personal" -> "Personal", "home" -> "Casa"; anything else is kept (trimmed). */
export function normalizePhoneLabel(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  return findLabel(text)?.value ?? text;
}

/** Text to show for a stored label, translated when it is one of the options. */
export function phoneLabelText(raw: string | null | undefined, names: Record<PhoneLabelKey, string>): string {
  const option = findLabel(raw);
  return option ? names[option.labelKey] : String(raw ?? '').trim();
}
