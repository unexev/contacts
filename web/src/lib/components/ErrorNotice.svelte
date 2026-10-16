<script>
  import { t } from '$lib/i18n.svelte.js';

  // An announced error with an optional retry. Styling lives in app.css (.load-error).
  let { message, onretry } = $props();
</script>

<div class="load-error" role="alert">
  <span>{message}</span>
  {#if onretry}
    <button class="btn btn-secondary" onclick={onretry}>{t('contactsRetry')}</button>
  {/if}
</div>
