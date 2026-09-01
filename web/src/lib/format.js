import { parseContactDate } from '$lib/date.js';

export function formatValue(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'object') {
    if (val.Valid !== undefined) return val.Valid && val.String ? val.String : '—';
    if (val.time) return val.time;
    return '—';
  }
  return String(val);
}

export function formatPhone(p) {
  if (typeof p === 'string') return p;
  return p.phone || p.number || p.value || '—';
}

export function formatEmail(e) {
  if (typeof e === 'string') return e;
  return e.email || e.address || e.value || '—';
}

export function formatUrl(u) {
  if (typeof u === 'string') return u;
  return u.url || u.value || '—';
}

export function formatDate(d) {
  if (!d) return '—';
  try {
    let dateStr = d;
    if (typeof d === 'object' && d !== null) {
      if (d.Valid && d.String) dateStr = d.String;
      else if (d.time) dateStr = d.time;
      else return '—';
    }
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return '—';
    const date = parseContactDate(dateStr);
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatSavedDate(timestamp) {
  const date = new Date(Number(timestamp));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}
