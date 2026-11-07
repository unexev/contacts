<script>
  import { locale, t, setLocale } from '$lib/i18n.svelte.js';

  const options = [
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'en', label: 'EN', name: 'English' }
  ];
</script>

<div class="lang-switch" role="group" aria-label={t('configLanguage')}>
  {#each options as option}
    <button
      type="button"
      lang={option.code}
      class:active={locale.value === option.code}
      aria-pressed={locale.value === option.code}
      aria-label={option.name}
      onclick={() => setLocale(option.code)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .lang-switch {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  button {
    min-width: 44px;
    min-height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text2);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  button.active {
    background: var(--surface);
    color: var(--accent-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
