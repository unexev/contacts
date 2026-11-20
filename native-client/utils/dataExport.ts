/**
 * Pure helpers for the account export/import (GET /api/export, POST /api/import).
 * No react-native imports so it can run under `node --test`.
 */

export const EXPORT_FORMAT = 'contacts-export';

export interface ImportCounts {
  created: number;
  updated: number;
  skipped: number;
}

export type DataErrorKey = 'invalid' | 'tooLarge' | 'network' | 'failed';

export class InvalidExportFile extends Error {
  constructor() {
    super('not a contacts export file');
  }
}

/** contacts-export-2026-11-20.json, like the web. */
export function exportFileName(now: Date = new Date()): string {
  return `contacts-export-${now.toISOString().slice(0, 10)}.json`;
}

/** Number of contacts in an export document (0 when the shape is unexpected). */
export function exportedContactCount(doc: any): number {
  const list = doc?.data?.contacts;
  return Array.isArray(list) ? list.length : 0;
}

/**
 * Reads the text of a file written by the export. Throws InvalidExportFile for
 * anything that is not an export document, so the server is not asked to judge it.
 */
export function parseExportFile(text: string): { format: string; version: number; data: object } {
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new InvalidExportFile();
  }
  if (!doc || typeof doc !== 'object' || doc.format !== EXPORT_FORMAT || typeof doc.version !== 'number' || !doc.data || typeof doc.data !== 'object') {
    throw new InvalidExportFile();
  }
  return doc;
}

/** The counts the server answers with, tolerant of a missing or partial body. */
export function importCounts(data: any): ImportCounts {
  const c = data?.contacts ?? data;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { created: n(c?.created), updated: n(c?.updated), skipped: n(c?.skipped) };
}

/** Maps a failed export/import status (0 = network failure) to a message key. */
export function mapDataFailure(status: number): DataErrorKey {
  if (status === 0) return 'network';
  if (status === 400) return 'invalid';
  if (status === 413) return 'tooLarge';
  return 'failed';
}
