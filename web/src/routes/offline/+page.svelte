<script>
  import { locale, t } from '$lib/i18n.svelte.js';
  import {
    Info,
    HardDrive,
    Cloud,
    Bell,
    Search,
    FileUp,
    IdCard,
    Smartphone,
    Monitor,
    Laptop,
    Terminal
  } from '@lucide/svelte';

  const features = [
    { icon: HardDrive, title: 'offlineFeatStorageTitle', desc: 'offlineFeatStorageDesc' },
    { icon: Cloud, title: 'offlineFeatBackupTitle', desc: 'offlineFeatBackupDesc' },
    { icon: Bell, title: 'offlineFeatBirthdayTitle', desc: 'offlineFeatBirthdayDesc' },
    { icon: Search, title: 'offlineFeatSearchTitle', desc: 'offlineFeatSearchDesc' },
    { icon: FileUp, title: 'offlineFeatImportTitle', desc: 'offlineFeatImportDesc' },
    { icon: IdCard, title: 'offlineFeatDocsTitle', desc: 'offlineFeatDocsDesc' }
  ];

  const platforms = [
    { key: 'android', icon: Smartphone, name: 'Android', detail: 'Google Play', url: null },
    { key: 'windows', icon: Monitor, name: 'Windows', detail: '.exe', url: null },
    { key: 'macos', icon: Laptop, name: 'macOS', detail: '.dmg', url: null },
    { key: 'linux', icon: Terminal, name: 'Linux', detail: '.AppImage', url: null }
  ];

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }
</script>

<svelte:head>
  <title>{t('offlineAppName')}</title>
  <meta name="description" content={t('offlineMetaDescription')} />
</svelte:head>

<div class="landing">
  <nav class="landing-nav">
    <a href="/offline" class="brand">
      <span class="brand-mark">C</span>
      <span class="brand-name">{t('offlineAppName')}</span>
    </a>
    <div class="nav-actions">
      <a href="#features" class="nav-link">{t('landingNavFeatures')}</a>
      <a href="#downloads" class="nav-link">{t('offlineDownloadsTitle')}</a>
      <button class="nav-lang" onclick={toggleLang}>{locale.value.toUpperCase()}</button>
      <a href="/" class="btn btn-outline nav-web">{t('offlineNavWebLabel')}</a>
    </div>
  </nav>

  <section class="hero animate-in">
    <h1 class="hero-title">{t('offlineAppName')}</h1>
    <p class="hero-subtitle">{t('offlineHeroTagline')}</p>
  </section>

  <section class="notice">
    <Info size={20} class="notice-icon" />
    <div class="notice-copy">
      <p class="notice-title">{t('offlineNoticeTitle')}</p>
      <p class="notice-text">{t('offlineNoticeText')}</p>
    </div>
  </section>

  <section id="features" class="features">
    <h2 class="section-title">{t('offlineFeaturesTitle')}</h2>
    <p class="section-subtitle">{t('offlineFeaturesSubtitle')}</p>
    <div class="feature-grid">
      {#each features as f}
        <article class="card feature">
          <div class="feature-icon">
            <f.icon size={20} />
          </div>
          <h3 class="feature-title">{t(f.title)}</h3>
          <p class="feature-desc">{t(f.desc)}</p>
        </article>
      {/each}
    </div>
  </section>

  <section id="downloads" class="downloads">
    <h2 class="section-title">{t('offlineDownloadsTitle')}</h2>
    <p class="section-subtitle">{t('offlineDownloadsSubtitle')}</p>
    <div class="download-grid">
      {#each platforms as p (p.key)}
        <article class="card download-card">
          <span class="download-badge">{t('offlineComingSoon')}</span>
          <div class="download-icon">
            <p.icon size={22} />
          </div>
          <p class="download-name">{p.name}</p>
          <p class="download-detail">{p.detail}</p>
          {#if p.url}
            <a href={p.url} class="btn btn-primary download-btn">{t('offlineDownloadCta')}</a>
          {:else}
            <span class="btn btn-outline download-btn" aria-disabled="true">
              {t('offlineDownloadCta')}
            </span>
          {/if}
        </article>
      {/each}
    </div>
  </section>

  <footer class="landing-footer">
    <p>&copy; {new Date().getFullYear()} {t('offlineAppName')}. {t('landingRights')}</p>
  </footer>
</div>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .landing-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--text);
  }

  .brand:hover { text-decoration: none; }

  .brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .brand-name {
    display: none;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-link {
    display: none;
    font-size: 14px;
    color: var(--text2);
  }

  .nav-lang {
    min-width: 44px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .nav-web {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .hero {
    text-align: center;
    padding: 56px 16px 32px;
    max-width: 640px;
    margin: 0 auto;
  }

  .hero-title {
    font-size: 34px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.8px;
    margin-bottom: 16px;
  }

  .hero-subtitle {
    font-size: 17px;
    color: var(--text2);
  }

  .notice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    max-width: 640px;
    margin: 0 auto 8px;
    padding: 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .notice :global(.notice-icon) {
    flex-shrink: 0;
    color: var(--accent);
    margin-top: 2px;
  }

  .notice-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .notice-text {
    font-size: 14px;
    color: var(--text2);
  }

  .features {
    padding: 48px 16px;
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .section-title {
    font-size: 26px;
    font-weight: 800;
    text-align: center;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }

  .section-subtitle {
    text-align: center;
    color: var(--text2);
    margin-bottom: 32px;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .feature { padding: 24px; }

  .feature-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .feature-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .feature-desc {
    font-size: 14px;
    color: var(--text2);
  }

  .downloads {
    padding: 16px 16px 48px;
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .download-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .download-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 28px 20px;
  }

  .download-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--text2);
    background: var(--surface2);
    border: 1px solid var(--border);
  }

  .download-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .download-name {
    font-size: 16px;
    font-weight: 700;
  }

  .download-detail {
    font-size: 13px;
    color: var(--text2);
    margin-bottom: 16px;
  }

  .download-btn {
    min-height: 44px;
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .download-btn:hover { text-decoration: none; }

  .download-btn[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .btn-outline {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .landing-footer {
    margin-top: auto;
    text-align: center;
    padding: 24px 16px;
    border-top: 1px solid var(--border);
    font-size: 13px;
    color: var(--text2);
  }

  @media (min-width: 640px) {
    .landing-nav { padding: 8px 24px; }
    .brand-name { display: inline; }
    .nav-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 8px;
    }
    .hero { padding: 88px 24px 40px; }
    .hero-title { font-size: 48px; }
    .hero-subtitle { font-size: 19px; }
    .feature-grid { grid-template-columns: repeat(2, 1fr); }
    .download-grid { grid-template-columns: repeat(2, 1fr); }
    .section-title { font-size: 30px; }
  }

  @media (min-width: 960px) {
    .feature-grid { grid-template-columns: repeat(3, 1fr); }
    .download-grid { grid-template-columns: repeat(4, 1fr); }
  }
</style>
