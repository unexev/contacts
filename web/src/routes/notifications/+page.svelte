<script>
  import { A } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/button.svelte';

  let enabled = $state(false);
  let days = $state('0');
  let hour = $state('09');
  let minute = $state('00');
  let message = $state('');
  let status = $state('');
  onMount(() => {
    if (!A.token) goto('/login');
    try {
      const saved = JSON.parse(localStorage.getItem('notification_settings') || '{}');
      enabled = saved.enabled ?? false; days = String(saved.days ?? 0); hour = saved.hour ?? '09'; minute = saved.minute ?? '00'; message = saved.message ?? '';
    } catch {}
  });
  function save() {
    localStorage.setItem('notification_settings', JSON.stringify({ enabled, days: Number(days), hour, minute, message }));
    status = enabled ? 'Configuración guardada.' : 'Recordatorios cancelados.';
  }
  function cancel() { enabled = false; save(); }
</script>

<div class="settings-page animate-in">
  <h1>{t('notificationsTitle')}</h1>
  <p class="description">{t('notificationsDesc')}</p>
  <section class="section-card toggle-row"><div><h2>{t('notificationsEnabled')}</h2><p>{t('notificationsEnabledDesc')}</p></div><input aria-label={t('notificationsEnabled')} type="checkbox" role="switch" bind:checked={enabled} /></section>
  <section class="section-card"><h2>{t('notificationsDays')}</h2><div class="chips">{#each [['0','notificationsDay0'],['1','notificationsDay1'],['2','notificationsDay2'],['3','notificationsDay3'],['7','notificationsDay7']] as option}<button class:active={days === option[0]} onclick={() => days = option[0]}>{t(option[1])}</button>{/each}</div></section>
  <section class="section-card"><h2>{t('notificationsTime')}</h2><p>{t('notificationsTimeDesc')}</p><div class="time"><label>Hora<input type="text" maxlength="2" bind:value={hour} /></label><b>:</b><label>Minuto<input type="text" maxlength="2" bind:value={minute} /></label></div></section>
  <section class="section-card"><h2>{t('notificationsMessage')}</h2><p>{t('notificationsMessageDesc')}</p><textarea bind:value={message} placeholder="Ej. Cumpleaños de {name}"></textarea></section>
  <Button className="w-full" onclick={save}>{t('notificationsSave')}</Button>
  <Button variant="destructive" className="mt-2 w-full" onclick={cancel}>{t('notificationsCancel')}</Button>
  {#if status}<div class="status">{status}</div>{/if}
</div>

<style>
  .settings-page h1 { font-size: 1.75rem; margin-bottom:8px; }.description,.section-card p { color:var(--text2); font-size: 0.875rem; margin-bottom:16px; }
  .section-card { padding:16px; margin:14px 0; background:var(--surface); border:1px solid var(--border); border-radius:12px; }.section-card h2 { font-size: 1.0625rem; margin-bottom:6px; }.toggle-row { display:flex; align-items:center; justify-content:space-between; }/* Switch: a 52x44 hit area (44px touch target) drawing a 52x32 track and a 24px knob. */
  .toggle-row input { appearance:none; -webkit-appearance:none; position:relative; flex-shrink:0; width:52px; height:44px; margin:0; background:transparent; cursor:pointer; }
  .toggle-row input::before { content:''; position:absolute; left:0; top:6px; width:52px; height:32px; box-sizing:border-box; border:2px solid var(--text2); border-radius:16px; background:transparent; transition:background .15s, border-color .15s; }
  .toggle-row input::after { content:''; position:absolute; top:12px; left:8px; width:20px; height:20px; border-radius:50%; background:var(--text2); transition:transform .15s, background .15s; }
  .toggle-row input:checked::before { background:var(--accent-strong); border-color:var(--accent-strong); }
  .toggle-row input:checked::after { background:#fff; transform:translateX(20px); }
  @media (prefers-reduced-motion: reduce) { .toggle-row input::before, .toggle-row input::after { transition:none; } }
  .chips { display:flex; flex-wrap:wrap; gap:8px; }.chips button { padding:10px 14px; color:var(--text); background:var(--surface2); border:1px solid var(--border); border-radius:18px; cursor:pointer; }.chips button.active { color:#fff; background:var(--accent-strong); border-color:var(--accent-strong); }
  .time { display:flex; align-items:end; gap:10px; }.time label { flex:1; color:var(--text2); font-size: 0.75rem; }.time input,textarea { display:block; width:100%; margin-top:6px; padding:11px; color:var(--text); background:var(--surface2); border:1px solid var(--border); border-radius:10px; font:inherit; }.time b { padding-bottom:12px; }.time input { text-align:center; font-size: 1.125rem; }textarea { min-height:90px; resize:vertical; }.status { margin-top:12px; padding:12px; border-radius:8px; background:rgba(52,199,89,.15); color:var(--text); }
</style>
