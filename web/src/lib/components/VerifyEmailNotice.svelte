<script>
  import { api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import ErrorNotice from '$lib/components/ErrorNotice.svelte';

  // The password is only used to prove ownership when asking for a new link;
  // the account has no session yet, so the endpoint cannot rely on a token.
  let { email, password, onback } = $props();

  let sending = $state(false);
  let sent = $state(false);
  let error = $state('');

  async function resend() {
    sending = true;
    sent = false;
    error = '';
    try {
      await api('/api/auth/resend-verification', {
        method: 'POST',
        body: { email, password },
        keepSession: true
      });
      sent = true;
    } catch (err) {
      error = err?.status === 429 ? t('verifyResendWait')
        : err?.status === 409 ? t('verifyAlreadyDone')
        : t('verifyResendFailed');
    } finally {
      sending = false;
    }
  }
</script>

<div class="verify-notice">
  <h1 class="verify-title">{t('verifyTitle')}</h1>
  <p class="verify-text">{t('verifyBody')}<br /><strong>{email}</strong></p>
  <p class="verify-hint">{t('verifySpamHint')}</p>

  {#if error}
    <ErrorNotice message={error} />
  {/if}
  {#if sent}
    <p class="verify-sent" role="status">{t('verifyResent')}</p>
  {/if}

  <button class="btn btn-secondary btn-full" type="button" onclick={resend} disabled={sending}>
    {sending ? '...' : t('verifyResend')}
  </button>
  <button class="btn-link" type="button" onclick={onback}>{t('verifyBack')}</button>
</div>

<style>
  .verify-title { font-size: 1.5rem; font-weight: 700; text-align: center; margin-bottom: 14px; letter-spacing: -0.5px; }
  .verify-text { text-align: center; margin-bottom: 8px; word-break: break-word; }
  .verify-hint { text-align: center; color: var(--text2); font-size: 0.875rem; margin-bottom: 20px; }
  .verify-sent { text-align: center; font-size: 0.875rem; margin-bottom: 12px; }
  .btn-link { display: block; margin: 16px auto 0; background: none; border: 0; color: var(--accent-text); cursor: pointer; font-size: 0.875rem; }
</style>
