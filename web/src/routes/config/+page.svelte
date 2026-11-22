<script>
  import { A, api, logout } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Sun, Moon, Monitor, ChevronRight } from '@lucide/svelte';
  import { userPrefersMode, setMode, resetMode } from 'mode-watcher';
  import { downloadExport } from '$lib/export.js';
  import { showToast } from '$lib/toast.svelte.js';

  onMount(async () => {
    if (!A.token) { goto('/login'); return; }
    // The user is only kept in memory, so a page reload has to fetch it again.
    if (!A.user) {
      try {
        A.user = await api('/api/auth/me');
      } catch {
        // Leave the placeholders; an expired session is already handled by api().
      }
    }
  });

  let exporting = $state(false);

  async function handleExport() {
    exporting = true;
    try {
      const count = await downloadExport();
      showToast(t('exportDone').replace('{count}', count));
    } catch {
      showToast(t('exportFailed'));
    } finally {
      exporting = false;
    }
  }

  const initial = $derived((A.user?.name || A.user?.email || '?').trim().charAt(0).toUpperCase());

  function handleLogout() {
    logout();
    goto('/');
  }

</script>

<div class="config-page animate-in">
  <h1 class="config-title">{t('configTitle')}</h1>

  <section class="group" aria-label={t('configAccount')}>
    <div class="group-card">
      <div class="identity">
        <span class="avatar" aria-hidden="true">{initial}</span>
        <div class="identity-text">
          <span class="identity-name">{A.user?.name || '--'}</span>
          <span class="identity-email">{A.user?.email || '--'}</span>
        </div>
      </div>
      <a class="row row-link" href="/account">
        <span>{t('configManageAccount')}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </a>
    </div>
  </section>

  <section class="group" aria-labelledby="prefs-title">
    <h2 class="group-title" id="prefs-title">{t('configPreferences')}</h2>
    <div class="group-card">
      <div class="row">
        <span class="row-label">{t('configLanguage')}</span>
        <LangSwitch />
      </div>
      <div class="row row-stack">
        <span class="row-label" id="theme-label">{t('configTheme')}</span>
        <div class="theme-switcher" role="group" aria-labelledby="theme-label">
          <button type="button" class:active={userPrefersMode.current === 'light'} aria-pressed={userPrefersMode.current === 'light'} onclick={() => setMode('light')}>
            <Sun size={16} /> {t('themeLight')}
          </button>
          <button type="button" class:active={userPrefersMode.current === 'system'} aria-pressed={userPrefersMode.current === 'system'} onclick={resetMode}>
            <Monitor size={16} /> {t('themeSystem')}
          </button>
          <button type="button" class:active={userPrefersMode.current === 'dark'} aria-pressed={userPrefersMode.current === 'dark'} onclick={() => setMode('dark')}>
            <Moon size={16} /> {t('themeDark')}
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="group" aria-labelledby="data-title">
    <h2 class="group-title" id="data-title">{t('configData')}</h2>
    <div class="group-card">
      <div class="row row-stack">
        <p class="row-hint">{t('accountExportText')}</p>
        <button class="btn btn-secondary btn-full" type="button" onclick={handleExport} disabled={exporting} aria-busy={exporting}>
          {exporting ? '...' : t('accountExportAction')}
        </button>
      </div>
    </div>
  </section>

  <section class="group">
    <div class="group-card">
      <button class="row row-button" type="button" onclick={handleLogout}>
        <span class="logout">{t('configLogout')}</span>
      </button>
    </div>
  </section>
</div>

<style>
  .config-page { padding-bottom: 40px; }

  .config-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 20px;
    letter-spacing: -0.5px;
  }

  .group { margin-bottom: 24px; }

  .group-title {
    margin: 0 0 8px 4px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text2);
  }

  .group-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 8px 16px;
  }

  .row + .row, .identity + .row { border-top: 1px solid var(--border); }

  .row-stack { flex-direction: column; align-items: stretch; padding: 12px 16px 14px; }
  .row-label { font-size: 0.9375rem; color: var(--text); }
  .row-hint { margin: 0; font-size: 0.875rem; color: var(--text2); line-height: 1.4; }

  .row-link {
    color: var(--accent-text);
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
  }
  .row-link:hover { background: var(--surface2); }

  .row-button {
    width: 100%;
    border: 0;
    border-top: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
    justify-content: flex-start;
  }
  .row-button:hover { background: var(--surface2); }
  .logout { font-size: 0.9375rem; font-weight: 500; color: var(--danger-text); }

  .identity { display: flex; align-items: center; gap: 14px; padding: 16px; }

  .avatar {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent-strong);
    color: #fff;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .identity-text { display: flex; flex-direction: column; min-width: 0; }
  .identity-name { font-size: 1.0625rem; font-weight: 600; overflow-wrap: anywhere; }
  .identity-email { font-size: 0.875rem; color: var(--text2); overflow-wrap: anywhere; }

  .theme-switcher {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    background: var(--surface2);
    border-radius: 12px;
  }

  .theme-switcher button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 8px 6px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text2);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background .2s, color .2s, box-shadow .2s;
  }

  .theme-switcher button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, .16);
  }
</style>
