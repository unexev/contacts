<script>
  import { Bell, RefreshCw, Settings, ChevronRight } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte.js';
</script>

<div class="menu-page animate-in">
  <h1>{t('navMenu')}</h1>
  <a class="menu-item" href="/notifications">
    <span class="menu-icon"><Bell size={18} /></span>
    <span class="menu-copy"><strong>{t('menuNotifications')}</strong><small>{t('menuNotificationsDesc')}</small></span>
    <ChevronRight size={18} />
  </a>
  <a class="menu-item" href="/sync">
    <span class="menu-icon sync"><RefreshCw size={18} /></span>
    <span class="menu-copy"><strong>{t('menuSync')}</strong><small>{t('menuSyncDesc')}</small></span>
    <ChevronRight size={18} />
  </a>
  <a class="menu-item" href="/config">
    <span class="menu-icon"><Settings size={18} /></span>
    <span class="menu-copy"><strong>{t('menuSettings')}</strong><small>{t('menuSettingsDesc')}</small></span>
    <ChevronRight size={18} />
  </a>
</div>

<style>
  .menu-page h1 { font-size: 28px; margin-bottom: 22px; }
  .menu-item { display:flex; align-items:center; gap:12px; padding:15px; margin-bottom:12px; background:var(--surface); border:1px solid var(--border); border-radius:14px; color:var(--text); text-decoration:none; }
  .menu-item:hover { background:var(--surface2); text-decoration:none; }
  .menu-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:10px; color:var(--accent); background:rgba(10,132,255,.12); }
  .menu-icon.sync { color:#34c759; background:rgba(52,199,89,.12); }
  .menu-copy { display:flex; flex:1; flex-direction:column; gap:2px; }
  .menu-copy strong { font-size:16px; }
  .menu-copy small { color:var(--text2); font-size:12px; }
</style>
