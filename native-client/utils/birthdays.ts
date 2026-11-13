/**
 * Pure birthday selection used by the desktop/browser notifications.
 * Birthdates are stored as `dd/mm/yyyy`. Kept free of platform imports so it can be tested in Node.
 */

export interface BirthdayContact {
  contact_id: string;
  first_name: string;
  surname: string;
  birthdate?: string | null;
}

function dayMonth(birthdate: string): { day: number; month: number } | null {
  const parts = birthdate.split('/');
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }
  return { day, month };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Contacts whose birthday falls on `date` (local time). 29 Feb is celebrated on 1 Mar in non-leap years. */
export function birthdaysOn<T extends BirthdayContact>(contacts: T[], date: Date): T[] {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const leap = isLeapYear(date.getFullYear());
  return contacts.filter(c => {
    if (!c.birthdate) return false;
    const parsed = dayMonth(c.birthdate);
    if (!parsed) return false;
    if (parsed.day === 29 && parsed.month === 2 && !leap) return day === 1 && month === 3;
    return parsed.day === day && parsed.month === month;
  });
}

/** Contacts whose birthday is the day after `now` (local time). */
export function birthdaysTomorrow<T extends BirthdayContact>(contacts: T[], now: Date = new Date()): T[] {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return birthdaysOn(contacts, tomorrow);
}
