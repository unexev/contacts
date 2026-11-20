// @ts-ignore TS5097 - node --test needs the explicit extension
import { telHref, whatsappHref } from './phoneLinks.ts';

/**
 * Columns that give each list row its quick-action targets, the same choice the
 * server makes: the first active phone (else the first phone) and the first email.
 * Selected with the contact as `c`.
 */
export const PRIMARY_CONTACT_COLUMNS = `
  COALESCE((SELECT p.phone FROM contact_phone p WHERE p.contact_id = c.contact_id
            ORDER BY COALESCE(p.is_active, 1) DESC, p.id LIMIT 1), '') AS primary_phone,
  COALESCE((SELECT p.is_active = 0 FROM contact_phone p WHERE p.contact_id = c.contact_id
            ORDER BY COALESCE(p.is_active, 1) DESC, p.id LIMIT 1), 0) AS primary_phone_inactive,
  COALESCE((SELECT e.email FROM contact_email e WHERE e.contact_id = c.contact_id
            ORDER BY e.id LIMIT 1), '') AS primary_email`;

export type ContactActionKey = 'call' | 'whatsapp' | 'email' | 'copy';

export interface ContactAction {
  key: ContactActionKey;
  /** Link to open; absent for copy. */
  url?: string;
}

/**
 * Entries of the quick-actions menu for one phone and/or email. A number the
 * person no longer uses only offers Copy, so it is not dialled by mistake.
 */
export function contactActions(phone: string, email: string, canCall = true): ContactAction[] {
  const number = String(phone || '').trim();
  const address = String(email || '').trim();
  const out: ContactAction[] = [];
  if (number && canCall) {
    const tel = telHref(number);
    if (tel) out.push({ key: 'call', url: tel });
    const wa = whatsappHref(number);
    if (wa) out.push({ key: 'whatsapp', url: wa });
  }
  if (address) out.push({ key: 'email', url: `mailto:${address}` });
  if (number) out.push({ key: 'copy' });
  return out;
}
