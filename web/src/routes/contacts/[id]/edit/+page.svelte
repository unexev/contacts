<script>
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { parseContactDate } from '$lib/date.js';

  let id = $derived($page.params.id);
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
    if (!A.token) return goto('/');
    try {
      const [c, statuses] = await Promise.all([
        api(`/api/contacts/${id}`),
        api('/api/marital-statuses')
      ]);
      maritalStatuses = Array.isArray(statuses) ? statuses : (statuses?.statuses || []);
      first_name = c.first_name || ''; middle_name = c.middle_name || ''; surname = c.surname || '';
      const date = parseContactDate(c.birthdate);
      birthdate = date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : '';
      gender = c.gender || '';
      marital_status = c.status_id || '';
    } catch (e) { error = e.message; }
  });

  async function save(e) {
    e.preventDefault(); error = '';
    if (!first_name.trim() || !surname.trim()) { error = 'Nombre y apellido son obligatorios'; return; }
    saving = true;
    try {
      await api(`/api/contacts/${id}`, { method: 'PUT', body: { first_name, middle_name, surname, birthdate, gender, status_id: marital_status } });
      goto(`/contacts/${id}`);
    } catch (e) { error = e.message; } finally { saving = false; }
  }
</script>

<div class="new-contact-page animate-in">
  <div class="form-header"><button class="btn-ghost" onclick={() => goto(`/contacts/${id}`)}>{t('contactCancel')}</button><h1 class="form-title">{t('contactEdit')}</h1><button class="btn-ghost" onclick={save} disabled={saving}>{saving ? '...' : t('contactSave')}</button></div>
  {#if error}<div class="form-error-banner">{error}</div>{/if}
  <form onsubmit={save}>
    <div class="form-card">
      <div class="form-group"><label class="form-label" for="first_name">{t('contactFirstName')} *</label><input id="first_name" class="input" bind:value={first_name} /></div>
      <div class="form-group"><label class="form-label" for="middle_name">{t('contactMiddleName')}</label><input id="middle_name" class="input" bind:value={middle_name} /></div>
      <div class="form-group"><label class="form-label" for="surname">{t('contactSurname')} *</label><input id="surname" class="input" bind:value={surname} /></div>
    </div>
    <div class="form-card"><div class="form-group"><label class="form-label" for="birthdate">{t('contactBirthdate')}</label><input id="birthdate" class="input" type="date" bind:value={birthdate} /></div><div class="form-group"><label class="form-label" for="gender">{t('contactGender')}</label><select id="gender" class="select" bind:value={gender}><option value="">{t('contactGenderUnspecified')}</option><option value="MALE">{t('contactGenderMale')}</option><option value="FEMALE">{t('contactGenderFemale')}</option></select></div><div class="form-group"><label class="form-label" for="marital_status">{t('contactMaritalStatus')}</label><select id="marital_status" class="select" bind:value={marital_status}><option value="">—</option>{#each maritalStatuses as status}<option value={status.status_id}>{status.marital_status}</option>{/each}</select></div></div>
  </form>
</div>
