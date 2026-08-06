<script>
  import '../app.css';
  import { A, loadToken, setToken } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let { children } = $props();

  onMount(() => {
    loadToken();
  });

  let navItems = $derived([
    { href: '/contacts', label: t('navContacts') },
    { href: '/config', label: t('navConfig') }
  ]);

  let currentPath = $derived($page.url.pathname);
  let showNav = $derived(A.token && currentPath !== '/' && currentPath !== '/register');

  function handleLogout() {
    setToken('');
    goto('/');
  }

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }
</script>

{#if showNav}
  <nav class="topnav">
    <div class="topnav-inner">
      <a href="/contacts" class="topnav-logo">{t('appName')}</a>
      <div class="topnav-links">
        {#each navItems as item}
          <a
            href={item.href}
            class="topnav-link"
            class:active={currentPath.startsWith(item.href)}
          >
            {item.label}
          </a>
        {/each}
        <button class="topnav-lang" onclick={toggleLang}>
          {locale.value.toUpperCase()}
        </button>
      </div>
    </div>
  </nav>
{/if}

<main class:has-nav={showNav}>
  {@render children()}
</main>

<style>
  .topnav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    z-index: 100;
    display: flex;
    align-items: center;
  }

  .topnav-inner {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topnav-logo {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    text-decoration: none;
    letter-spacing: -0.3px;
  }

  .topnav-logo:hover { text-decoration: none; }

  .topnav-links {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .topnav-link {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text2);
    text-decoration: none;
    transition: all 0.15s;
  }

  .topnav-link:hover {
    color: var(--text);
    background: var(--surface);
    text-decoration: none;
  }

  .topnav-link.active {
    color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }

  .topnav-lang {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
  }

  .topnav-lang:hover {
    color: var(--text);
    border-color: var(--text2);
  }

  main {
    padding: 20px;
    max-width: 720px;
    margin: 0 auto;
  }

  main.has-nav {
    padding-top: 76px;
  }
</style>
