<script>
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let first_name = $state('');
  let middle_name = $state('');
  let surname = $state('');
  let birthdate = $state('');
  let gender = $state('');
  let marital_status = $state('');
  let maritalStatuses = $state([]);
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    if (!A.token) { goto('/'); return; }
    try {
      const data = await api('/api/marital-statuses');
      maritalStatuses = Array.isArray(data) ? data : (data?.statuses || []);
    } catch {}
  });

  async function handleSave(e) {
    e.preventDefault();
    error = '';
    if (!first_name.trim()) { error = 'First name is required'; return; }
    if (!surname.trim()) { error = 'Surname is required'; return; }
    if (first_name.length > 255) { error = 'First name too long'; return; }
    if (surname.length > 255) { error = 'Surname too long'; return; }
    saving = true;
    try {
      const body = { first_name, middle_name, surname, gender };
      if (birthdate) body.birthdate = birthdate;
      if (marital_status) body.marital_status = marital_status;

      const data = await api('/api/contacts', { method: 'POST', body });
      const id = data.contact_id || data.id;
      if (id) goto(`/contacts/${id}`);
      else goto('/contacts');
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="new-contact-page animate-in">
  <div class="form-header">
    <button class="btn-ghost" onclick={() => goto('/contacts')}>{t('contactCancel')}</button>
    <h1 class="form-title">{t('contactNew')}</h1>
    <button class="btn-ghost" onclick={handleSave} disabled={saving}>
      {saving ? '...' : t('contactSave')}
    </button>
  </div>

  {#if error}
    <div class="form-error-banner">{error}</div>
  {/if}

  <form onsubmit={handleSave}>
    <div class="form-card">
      <div class="form-group">
        <label class="form-label" for="first_name">{t('contactFirstName')} *</label>
        <input
          id="first_name"
          class="input"
          type="text"
          bind:value={first_name}
          required
          placeholder={t('contactFirstName')}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="middle_name">{t('contactMiddleName')}</label>
        <input
          id="middle_name"
          class="input"
          type="text"
          bind:value={middle_name}
          placeholder={t('contactMiddleName')}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="surname">{t('contactSurname')}</label>
        <input
          id="surname"
          class="input"
          type="text"
          bind:value={surname}
          placeholder={t('contactSurname')}
        />
      </div>
    </div>

    <div class="form-card">
      <div class="form-group">
        <label class="form-label" for="birthdate">{t('contactBirthdate')}</label>
        <input
          id="birthdate"
          class="input"
          type="date"
          bind:value={birthdate}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="gender">{t('contactGender')}</label>
        <select id="gender" class="select" bind:value={gender}>
          <option value="">{t('contactGenderUnspecified')}</option>
          <option value="male">{t('contactGenderMale')}</option>
          <option value="female">{t('contactGenderFemale')}</option>
          <option value="other">{t('contactGenderOther')}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="marital_status">{t('contactMaritalStatus')}</label>
        <select id="marital_status" class="select" bind:value={marital_status}>
          <option value="">—</option>
          {#each maritalStatuses as status}
            <option value={status.status_id}>
              {status.marital_status}
            </option>
          {/each}
        </select>
      </div>
    </div>
  </form>
</div>

<style>
  .new-contact-page { padding-bottom: 40px; }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .form-title {
    font-size: 18px;
    font-weight: 600;
  }

  .form-card {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 16px;
    margin-bottom: 16px;
  }

  .form-error-banner {
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 16px;
    text-align: center;
  }
</style>
