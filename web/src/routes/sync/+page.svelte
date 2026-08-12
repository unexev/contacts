<script>
  import { A, apiRaw } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/button.svelte';

  let status = $state('');
  let fileInput;
  onMount(() => { if (!A.token) goto('/'); });

  async function exportContacts() {
    try {
      const response = await apiRaw('/api/contacts?limit=500');
      const data = response?.data ?? response;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `contacts_backup_${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
      status = t('syncExported');
    } catch (error) { status = error.message; }
  }

  function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { status = t('syncImported'); };
    reader.readAsText(file);
  }
</script>

<div class="sync-page animate-in">
  <h1>{t('syncTitle')}</h1>
  <section class="section-card">
    <h2>Base de datos</h2>
    <p>{t('syncDesc')}</p>
    <label class="btn btn-secondary btn-full file-button">{t('syncImportVcf')}<input type="file" accept=".vcf,text/vcard" onchange={importFile} /></label>
    <Button className="mb-2 w-full" onclick={exportContacts}>{t('syncExport')}</Button>
    <label class="btn btn-primary btn-full file-button">{t('syncImport')}<input type="file" accept=".json,.vcf" bind:this={fileInput} onchange={importFile} /></label>
  </section>
  {#if status}<div class="status">{status}</div>{/if}
</div>

<style>
  .sync-page h1 { font-size:28px; margin-bottom:22px; }.section-card { padding:16px; background:var(--surface); border:1px solid var(--border); border-radius:12px; }.section-card h2 { font-size:17px; margin-bottom:6px; }.section-card p { color:var(--text2); font-size:14px; margin-bottom:16px; }.file-button { position:relative; overflow:hidden; margin-bottom:10px; }.file-button input { position:absolute; inset:0; opacity:0; cursor:pointer; }.status { margin-top:14px; padding:12px; border-radius:8px; background:rgba(52,199,89,.15); }
</style>
