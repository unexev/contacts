<script>
  import { A, setToken } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Sun, Moon, Monitor } from '@lucide/svelte';
  import { userPrefersMode, setMode, resetMode } from 'mode-watcher';

  onMount(() => {
    if (!A.token) goto('/');
  });

  function handleLogout() {
    setToken('');
    A.user = null;
    goto('/');
  }

  function setLang(lang) {
    locale.value = lang;
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
        <div class="lang-options">
          <button
            class="lang-btn"
            class:active={locale.value === 'es'}
            onclick={() => setLang('es')}
          >
            <span>Espanol</span>
          </button>
          <button
            class="lang-btn"
            class:active={locale.value === 'en'}
            onclick={() => setLang('en')}
          >
            <span>English</span>
          </button>
        </div>
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
        {#if A.user}
          <div class="field-row">
            <span class="field-label">Name</span>
            <span class="field-value">{A.user.name || '--'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Email</span>
            <span class="field-value">{A.user.email || '--'}</span>
          </div>
        {:else}
          <div class="field-row">
            <span class="field-value" style="color: var(--text2)">Token active</span>
          </div>
        {/if}
      </div>
    </div>

    <button class="btn btn-danger btn-full logout-btn" onclick={handleLogout}>
      {t('configLogout')}
    </button>
  </div>
</div>

<style>
  .config-page { padding-bottom: 40px; }

  .config-title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 24px;
    letter-spacing: -0.5px;
  }

  .config-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .lang-options {
    display: flex;
    gap: 10px;
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
    font-size: 13px;
    cursor: pointer;
    transition: background .2s, color .2s, box-shadow .2s;
  }

  .theme-switcher button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, .16);
  }

  .lang-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: var(--surface2);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .lang-btn:hover {
    border-color: var(--text2);
  }

  .lang-btn.active {
    border-color: var(--accent);
    background: rgba(10, 132, 255, 0.12);
    color: var(--accent);
  }

  .logout-btn {
    margin-top: 8px;
  }
</style>
