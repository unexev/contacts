<script>
  import '../app.css';
  import { A, loadToken, setToken } from '$lib/api.svelte.js';
  import { contacts } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ModeWatcher } from 'mode-watcher';
  import { Users, CalendarDays, Settings } from '@lucide/svelte';

  let { children } = $props();

  // Restore the session before child routes run their access checks.
  loadToken();

  let navItems = $derived([
    { href: '/contacts', label: t('navContacts'), icon: Users },
    { href: '/calendar', label: t('navCalendar'), icon: CalendarDays },
    { href: '/config', label: t('navConfig'), icon: Settings }
  ]);

  const bareRoutes = ['/', '/login', '/register', '/offline'];
  let currentPath = $derived($page.url.pathname);
  let showNav = $derived(A.token && !bareRoutes.includes(currentPath));
  let contactCount = $derived(contacts.value.length);

  function handleLogout() {
    setToken('');
    goto('/');
  }
</script>

<ModeWatcher themeColors={{ dark: '#000000', light: '#f2f2f7' }} />

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
            {#if item.href === '/contacts' && contactCount > 0}
              <span class="badge">{contactCount}</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  </nav>

  <nav class="tabbar" aria-label="Main">
    {#each navItems as item}
      {@const Icon = item.icon}
      <a
        href={item.href}
        class="tab"
        class:active={currentPath.startsWith(item.href)}
        aria-current={currentPath.startsWith(item.href) ? 'page' : undefined}
      >
        <Icon size={22} aria-hidden="true" />
        <span>{item.label}</span>
        {#if item.href === '/contacts' && contactCount > 0}
          <span class="tab-badge">{contactCount}</span>
        {/if}
      </a>
    {/each}
  </nav>
{/if}

<main class:has-nav={showNav} class:full={currentPath === '/' || currentPath === '/offline'}>
  {@render children()}
</main>

<style>
  .topnav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
     background: color-mix(in srgb, var(--surface) 88%, transparent);
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
    padding: 0 16px;
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

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 5px;
    margin-left: 6px;
    background: var(--accent);
    color: white;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
  }

  .topnav-link {
    display: none;
  }

  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
  }

  .tab {
    position: relative;
    flex: 1;
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text2);
    text-decoration: none;
  }

  .tab:hover { text-decoration: none; }

  .tab.active { color: var(--accent); }

  .tab-badge {
    position: absolute;
    top: 6px;
    left: calc(50% + 6px);
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: white;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
  }

  @media (min-width: 601px) {
    .tabbar { display: none; }

    .topnav-inner { padding: 0 20px; }

    .topnav-link {
      display: inline-block;
    }
  }

  main {
    padding: 20px;
    max-width: 720px;
    margin: 0 auto;
  }

  main.has-nav {
    padding-top: 76px;
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }

  @media (min-width: 601px) {
    main.has-nav { padding-bottom: 20px; }
  }

  main.full {
    max-width: none;
    padding: 0;
  }
</style>
