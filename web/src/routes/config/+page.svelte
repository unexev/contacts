<script>
  import { A, api, setToken } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Sun, Moon, Monitor } from '@lucide/svelte';
  import { userPrefersMode, setMode, resetMode } from 'mode-watcher';

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

  function handleLogout() {
    setToken('');
    A.user = null;
    goto('/');
  }

</script>

<div class="config-page animate-in">
  <h1 class="config-title">{t('configTitle')}</h1>

  <div class="config-section">
    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">{t('configLanguage')}</span>
      </div>
      <div class="section-card-body">
        <LangSwitch />
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">Tema</span>
      </div>
      <div class="theme-switcher" role="group" aria-label="Tema">
        <button class:active={userPrefersMode.current === 'light'} onclick={() => setMode('light')}>
          <Sun size={16} /> Claro
        </button>
        <button class:active={userPrefersMode.current === 'dark'} onclick={() => setMode('dark')}>
          <Moon size={16} /> Oscuro
        </button>
        <button class:active={userPrefersMode.current === 'system'} onclick={resetMode}>
          <Monitor size={16} /> Sistema
        </button>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">{t('configUser')}</span>
      </div>
      <div class="section-card-body">
        <div class="field-row">
          <span class="field-label">{t('configName')}</span>
          <span class="field-value">{A.user?.name || '--'}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{t('configEmail')}</span>
          <span class="field-value">{A.user?.email || '--'}</span>
        </div>
      </div>
    </div>

    <a class="btn btn-secondary btn-full" href="/account">{t('configAccount')}</a>

    <button class="btn btn-danger btn-full logout-btn" onclick={handleLogout}>
      {t('configLogout')}
    </button>
  </div>
</div>

<style>
  .config-page { padding-bottom: 40px; }

  .config-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 24px;
    letter-spacing: -0.5px;
  }

  .config-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }


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
    min-height: 38px;
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




  .logout-btn {
    margin-top: 8px;
  }
</style>
