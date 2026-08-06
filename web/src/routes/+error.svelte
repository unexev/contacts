<script>
  import { page } from '$app/stores';
  import { t } from '$lib/i18n.svelte.js';

  let error = $derived($page.error);
</script>

<div class="error-page animate-in">
  <div class="error-card">
    <div class="error-icon">!</div>
    <h1 class="error-title">{t('msgError')}</h1>
    <p class="error-message">{error?.message || 'Unknown error'}</p>
    <a href="/" class="btn btn-primary">Home</a>
  </div>
</div>

<style>
  .error-page {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .error-card {
    text-align: center;
    padding: 40px;
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    max-width: 400px;
    width: 100%;
  }

  .error-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    font-size: 28px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
  }

  .error-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .error-message {
    font-size: 15px;
    color: var(--text2);
    margin-bottom: 24px;
    word-break: break-word;
  }
</style>
