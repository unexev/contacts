<script>
  import { A, api, setToken } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  onMount(() => {
    if (A.token) goto('/contacts');
  });

  async function handleLogin(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      setToken(data.token);
      if (data.user) A.user = data.user;
      goto('/contacts');
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-card animate-in">
    <h1 class="login-title">{t('loginTitle')}</h1>

    {#if error}
      <div class="login-error">{error}</div>
    {/if}

    <form onsubmit={handleLogin}>
      <div class="form-group">
        <label class="form-label" for="email">{t('loginEmail')}</label>
        <input
          id="email"
          class="input"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          placeholder={t('loginEmail')}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="password">{t('loginPassword')}</label>
        <input
          id="password"
          class="input"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          placeholder={t('loginPassword')}
        />
      </div>

      <button class="btn btn-primary btn-full" type="submit" disabled={loading}>
        {loading ? '...' : t('loginButton')}
      </button>
    </form>

    <p class="login-footer">
      {t('loginNoAccount')}
      <a href="/register">{t('loginRegister')}</a>
    </p>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .login-card {
    width: 100%;
    max-width: 380px;
    padding: 36px 28px;
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
  }

  .login-title {
    font-size: 28px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 28px;
    letter-spacing: -0.5px;
  }

  .login-error {
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 16px;
    text-align: center;
  }

  .login-footer {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: var(--text2);
  }

  .login-footer a { margin-left: 4px; }
</style>
