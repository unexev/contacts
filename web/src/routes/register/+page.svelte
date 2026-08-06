<script>
  import { A, api, setToken } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  onMount(() => {
    if (A.token) goto('/contacts');
  });

  async function handleRegister(e) {
    e.preventDefault();
    error = '';
    if (!name || !email || !password) { error = 'All fields are required'; return; }
    if (password.length < 8) { error = 'Password must be at least 8 characters'; return; }
    if (name.length > 255) { error = 'Name too long'; return; }
    loading = true;
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { name, email, password }
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

<div class="register-page">
  <div class="register-card animate-in">
    <h1 class="register-title">{t('registerTitle')}</h1>

    {#if error}
      <div class="register-error">{error}</div>
    {/if}

    <form onsubmit={handleRegister}>
      <div class="form-group">
        <label class="form-label" for="name">{t('registerName')}</label>
        <input
          id="name"
          class="input"
          type="text"
          bind:value={name}
          required
          autocomplete="name"
          placeholder={t('registerName')}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="email">{t('registerEmail')}</label>
        <input
          id="email"
          class="input"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          placeholder={t('registerEmail')}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="password">{t('registerPassword')}</label>
        <input
          id="password"
          class="input"
          type="password"
          bind:value={password}
          required
          minlength="6"
          autocomplete="new-password"
          placeholder={t('registerPassword')}
        />
      </div>

      <button class="btn btn-primary btn-full" type="submit" disabled={loading}>
        {loading ? '...' : t('registerButton')}
      </button>
    </form>

    <p class="register-footer">
      {t('registerHasAccount')}
      <a href="/">{t('registerLogin')}</a>
    </p>
  </div>
</div>

<style>
  .register-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .register-card {
    width: 100%;
    max-width: 380px;
    padding: 36px 28px;
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
  }

  .register-title {
    font-size: 28px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 28px;
    letter-spacing: -0.5px;
  }

  .register-error {
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 16px;
    text-align: center;
  }

  .register-footer {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: var(--text2);
  }

  .register-footer a { margin-left: 4px; }
</style>
