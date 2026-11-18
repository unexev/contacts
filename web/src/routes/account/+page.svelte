<script>
  import { A, api, setToken, logout } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import ErrorNotice from '$lib/components/ErrorNotice.svelte';
  import { friendlyError } from '$lib/errors.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let currentPassword = $state('');
  let email = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  let deleting = $state(false);
  let deletePassword = $state('');
  let deleteError = $state('');
  let deleteLoading = $state(false);

  async function handleDelete(e) {
    e.preventDefault();
    deleteError = '';
    if (!deletePassword) { deleteError = t('accountCurrentRequired'); return; }
    deleteLoading = true;
    try {
      await api('/api/auth/me', { method: 'DELETE', body: { current_password: deletePassword }, keepSession: true });
      logout();
      goto('/login');
    } catch (err) {
      if (err?.expired) { goto('/login'); return; }
      deleteError = err?.message === 'Invalid credentials' ? t('accountWrongPassword') : friendlyError(err, t);
    } finally {
      deleteLoading = false;
    }
  }

  onMount(() => {
    if (!A.token) goto('/login');
  });

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    success = '';
    const newEmail = email.trim();
    if (!currentPassword) { error = t('accountCurrentRequired'); return; }
    if (!newEmail && !newPassword) { error = t('accountNothingToChange'); return; }
    if (newPassword && newPassword.length < 8) { error = t('authPasswordShort'); return; }
    if (newPassword && newPassword !== confirmPassword) { error = t('accountPasswordMismatch'); return; }

    const body = { current_password: currentPassword };
    if (newEmail) body.email = newEmail;
    if (newPassword) body.new_password = newPassword;

    loading = true;
    try {
      const data = await api('/api/auth/me', { method: 'PUT', body, keepSession: true });
      setToken(data.token, data.refresh_token);
      if (data.user) A.user = data.user;
      currentPassword = '';
      email = '';
      newPassword = '';
      confirmPassword = '';
      success = t('accountSaved');
    } catch (err) {
      if (err?.expired) { goto('/login'); return; }
      error = err?.message === 'Invalid credentials' ? t('accountWrongPassword') : friendlyError(err, t);
    } finally {
      loading = false;
    }
  }
</script>

<div class="account-page animate-in">
  <h1 class="account-title">{t('accountTitle')}</h1>
  <p class="account-intro">{t('accountIntro')}</p>

  {#if error}
    <ErrorNotice message={error} />
  {/if}
  {#if success}
    <p class="account-success" role="status">{success}</p>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="form-group">
      <label class="form-label" for="current-password">{t('accountCurrentPassword')}</label>
      <input id="current-password" class="input" type="password" bind:value={currentPassword}
        required autocomplete="current-password" />
    </div>
    <div class="form-group">
      <label class="form-label" for="new-email">{t('accountNewEmail')}</label>
      <input id="new-email" class="input" type="email" bind:value={email} autocomplete="email" />
    </div>
    <div class="form-group">
      <label class="form-label" for="new-password">{t('accountNewPassword')}</label>
      <input id="new-password" class="input" type="password" bind:value={newPassword}
        autocomplete="new-password" minlength="8" />
    </div>
    <div class="form-group">
      <label class="form-label" for="confirm-password">{t('accountConfirmPassword')}</label>
      <input id="confirm-password" class="input" type="password" bind:value={confirmPassword}
        autocomplete="new-password" />
    </div>

    <button class="btn btn-primary btn-full" type="submit" disabled={loading}>
      {loading ? '...' : t('accountSave')}
    </button>
  </form>

  <section class="danger-zone">
    <h2 class="danger-title">{t('accountDeleteTitle')}</h2>
    <p class="danger-text">{t('accountDeleteWarning')}</p>
    {#if !deleting}
      <button class="btn btn-secondary btn-full" type="button" onclick={() => (deleting = true)}>
        {t('accountDeleteAction')}
      </button>
    {:else}
      {#if deleteError}
        <ErrorNotice message={deleteError} />
      {/if}
      <form onsubmit={handleDelete}>
        <div class="form-group">
          <label class="form-label" for="delete-password">{t('accountDeletePrompt')}</label>
          <input id="delete-password" class="input" type="password" bind:value={deletePassword}
            required autocomplete="current-password" />
        </div>
        <div class="danger-actions">
          <button class="btn btn-secondary" type="button"
            onclick={() => { deleting = false; deletePassword = ''; deleteError = ''; }}>
            {t('accountDeleteCancel')}
          </button>
          <button class="btn btn-danger" type="submit" disabled={deleteLoading}>
            {deleteLoading ? '...' : t('accountDeleteConfirm')}
          </button>
        </div>
      </form>
    {/if}
  </section>

  <p class="account-footer"><a href="/config">{t('accountBack')}</a></p>
</div>

<style>
  .account-page { padding-bottom: 40px; max-width: 420px; }
  .account-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
  .account-intro { color: var(--text2); font-size: 0.875rem; margin-bottom: 20px; }
  .account-success { color: var(--text); margin-bottom: 16px; font-size: 0.875rem; }
  .danger-zone { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); }
  .danger-title { font-size: 1.0625rem; font-weight: 700; margin-bottom: 6px; }
  .danger-text { color: var(--text2); font-size: 0.875rem; margin-bottom: 14px; }
  .danger-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .account-footer { margin-top: 20px; font-size: 0.875rem; }
</style>
