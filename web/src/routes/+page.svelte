<script>
  import { A } from '$lib/api.svelte.js';
  import { locale, t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Contact, IdCard, CalendarDays, Users, RefreshCw, Globe, Check } from '@lucide/svelte';

  let ready = $state(false);

  onMount(() => {
    if (A.token) goto('/contacts');
    else ready = true;
  });

  const features = [
    { icon: Contact, title: 'landingFeatContactsTitle', desc: 'landingFeatContactsDesc' },
    { icon: IdCard, title: 'landingFeatDocsTitle', desc: 'landingFeatDocsDesc' },
    { icon: CalendarDays, title: 'landingFeatCalendarTitle', desc: 'landingFeatCalendarDesc' },
    { icon: Users, title: 'landingFeatRelatedTitle', desc: 'landingFeatRelatedDesc' },
    { icon: RefreshCw, title: 'landingFeatSyncTitle', desc: 'landingFeatSyncDesc' },
    { icon: Globe, title: 'landingFeatNationalitiesTitle', desc: 'landingFeatNationalitiesDesc' }
  ];

  const plans = [
    { name: 'Free', price: '$0', period: 'landingPlanFreePeriod', features: 'landingPlanFreeFeatures', cta: 'landingPlanFreeCta', primary: false },
    { name: 'Pro', price: '$9.99', period: 'landingPlanProPeriod', features: 'landingPlanProFeatures', cta: 'landingPlanProCta', primary: true }
  ];

  function toggleLang() {
    locale.value = locale.value === 'es' ? 'en' : 'es';
  }
</script>

<svelte:head>
  <title>{t('appName')}</title>
  <meta name="description" content={t('landingHeroSubtitle')} />
</svelte:head>

{#if ready}
  <div class="landing">
    <nav class="landing-nav">
      <a href="/" class="brand">
        <span class="brand-mark">C</span>
        <span class="brand-name">{t('appName')}</span>
      </a>
      <div class="nav-actions">
        <a href="#features" class="nav-link">{t('landingNavFeatures')}</a>
        <a href="#pricing" class="nav-link">{t('landingNavPricing')}</a>
        <button class="nav-lang" onclick={toggleLang}>{locale.value.toUpperCase()}</button>
        <a href="/login" class="btn btn-primary nav-login">{t('loginTitle')}</a>
      </div>
    </nav>

    <section class="hero animate-in">
      <h1 class="hero-title">
        {t('landingHeroTitle')}<br />
        <span class="highlight">{t('landingHeroHighlight')}</span>
      </h1>
      <p class="hero-subtitle">{t('landingHeroSubtitle')}</p>
      <div class="hero-actions">
        <a href="/register" class="btn btn-primary cta">{t('landingCtaStart')}</a>
        <a href="#features" class="btn btn-outline cta">{t('landingCtaFeatures')}</a>
      </div>
    </section>

    <section id="features" class="features">
      <h2 class="section-title">{t('landingFeaturesTitle')}</h2>
      <p class="section-subtitle">{t('landingFeaturesSubtitle')}</p>
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

    <section id="pricing" class="pricing">
      <h2 class="section-title">{t('landingPricingTitle')}</h2>
      <p class="section-subtitle">{t('landingPricingSubtitle')}</p>
      <div class="plan-grid">
        {#each plans as plan}
          <article class="card plan" class:plan-primary={plan.primary}>
            {#if plan.primary}
              <span class="plan-badge">{t('landingPlanPopular')}</span>
            {/if}
            <p class="plan-name">{plan.name}</p>
            <p class="plan-price">{plan.price}</p>
            <p class="plan-period">{t(plan.period)}</p>
            <ul class="plan-features">
              {#each t(plan.features) as feat}
                <li><Check size={16} class="plan-check" /> {feat}</li>
              {/each}
            </ul>
            <a href="/register" class="btn cta {plan.primary ? 'btn-primary' : 'btn-outline'}">{t(plan.cta)}</a>
          </article>
        {/each}
      </div>
    </section>

    <section class="final">
      <h2 class="section-title">{t('landingFinalTitle')}</h2>
      <p class="section-subtitle">{t('landingFinalSubtitle')}</p>
      <div class="hero-actions">
        <a href="/register" class="btn btn-primary cta">{t('landingCtaStart')}</a>
        <a href="/login" class="btn btn-outline cta">{t('loginTitle')}</a>
      </div>
    </section>

    <footer class="landing-footer">
      <p>&copy; {new Date().getFullYear()} {t('appName')}. {t('landingRights')}</p>
    </footer>
  </div>
{/if}

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

  .nav-login {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  .hero {
    text-align: center;
    padding: 56px 16px;
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

  .highlight { color: var(--accent); }

  .hero-subtitle {
    font-size: 17px;
    color: var(--text2);
    margin-bottom: 32px;
  }

  .hero-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cta {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .cta:hover { text-decoration: none; }

  .btn-outline {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
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

  .pricing {
    padding: 48px 16px;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }

  .plan-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .plan {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 32px 24px;
    text-align: center;
  }

  .plan-primary {
    border-color: var(--accent);
    background: linear-gradient(to bottom, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface));
  }

  .plan-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    background: var(--accent);
  }

  .plan-name {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text2);
    margin-bottom: 8px;
  }

  .plan-price {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -1px;
    line-height: 1.1;
  }

  .plan-period {
    font-size: 14px;
    color: var(--text2);
    margin-bottom: 24px;
  }

  .plan-features {
    list-style: none;
    text-align: left;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 32px;
    flex: 1;
  }

  .plan-features li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .plan-features :global(.plan-check) {
    color: var(--accent);
    flex-shrink: 0;
  }

  .final {
    padding: 48px 16px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .final .hero-actions {
    max-width: 420px;
    margin: 0 auto;
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
    .hero { padding: 88px 24px; }
    .hero-title { font-size: 48px; }
    .hero-subtitle { font-size: 19px; }
    .hero-actions {
      flex-direction: row;
      justify-content: center;
    }
    .cta { padding: 0 28px; }
    .feature-grid { grid-template-columns: repeat(2, 1fr); }
    .plan-grid { grid-template-columns: repeat(2, 1fr); }
    .section-title { font-size: 30px; }
  }

  @media (min-width: 960px) {
    .feature-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
