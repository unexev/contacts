/** Contact photo rules shared with the server (JPEG/PNG/WebP, at most 2 MB). Pure, runs under `node --test`. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type PhotoError = 'type' | 'size' | 'network' | 'syncFirst' | 'unavailable' | 'failed';

/** Checks a picked file before uploading; an unknown size is left to the server. */
export function validatePhotoFile(file: { mimeType?: string | null; size?: number | null }): 'type' | 'size' | null {
  if (!file.mimeType || !PHOTO_TYPES.includes(file.mimeType.toLowerCase())) return 'type';
  if (typeof file.size === 'number' && file.size > PHOTO_MAX_BYTES) return 'size';
  return null;
}

export function mapPhotoFailure(status: number): PhotoError {
  if (status === 0) return 'network';
  if (status === 400) return 'type';
  // The contact exists only on this device until the first sync.
  if (status === 404) return 'syncFirst';
  if (status === 413) return 'size';
  if (status === 503) return 'unavailable';
  return 'failed';
}

/** The signed photo URL of an API answer, only when it is a web URL. */
export function photoUrlFrom(data: unknown): string | null {
  const url = (data as { photo_url?: unknown } | null | undefined)?.photo_url;
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

export function contactInitials(firstName: string, surname: string): string {
  const letters = [firstName, surname].map((s) => s.trim().charAt(0).toUpperCase()).join('');
  return letters || '?';
}

/** contact_id -> signed photo URL from a contact list answer; contacts without a usable URL are left out. */
export function photoUrlsFrom(data: unknown): Record<string, string> {
  const urls: Record<string, string> = {};
  if (!Array.isArray(data)) return urls;
  for (const item of data) {
    const id = (item as { contact_id?: unknown } | null)?.contact_id;
    const url = photoUrlFrom(item);
    if (typeof id === 'string' && url) urls[id] = url;
  }
  return urls;
}
