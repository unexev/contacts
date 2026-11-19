import { apiRaw } from '$lib/api.svelte.js';

// Downloads the user's data as a JSON file. `query` holds the same filters as
// the contact list (without paging); empty exports everything.
export async function downloadExport(query = '') {
  const doc = await apiRaw(`/api/export${query ? `?${query}` : ''}`);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return doc?.data?.contacts?.length ?? 0;
}
