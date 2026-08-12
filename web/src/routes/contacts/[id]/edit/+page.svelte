<script>
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let id = $derived($page.params.id);
  let first_name = $state('');
  let middle_name = $state('');
  let surname = $state('');
  let birthdate = $state('');
  let gender = $state('');
  let error = $state('');
  let saving = $state(false);

  onMount(async () => {
    if (!A.token) return goto('/');
    try {
      const c = await api(`/api/contacts/${id}`);
      first_name = c.first_name || ''; middle_name = c.middle_name || ''; surname = c.surname || '';
      birthdate = typeof c.birthdate === 'string' ? c.birthdate.slice(0, 10) : '';
      gender = c.gender || '';
    } catch (e) { error = e.message; }
  });

  async function save(e) {
    e.preventDefault(); error = '';
    if (!first_name.trim() || !surname.trim()) { error = 'Nombre y apellido son obligatorios'; return; }
    saving = true;
    try {
      await api(`/api/contacts/${id}`, { method: 'PUT', body: { first_name, middle_name, surname, birthdate, gender } });
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
    <div class="form-card"><div class="form-group"><label class="form-label" for="birthdate">{t('contactBirthdate')}</label><input id="birthdate" class="input" type="date" bind:value={birthdate} /></div><div class="form-group"><label class="form-label" for="gender">{t('contactGender')}</label><select id="gender" class="select" bind:value={gender}><option value="">{t('contactGenderUnspecified')}</option><option value="MALE">{t('contactGenderMale')}</option><option value="FEMALE">{t('contactGenderFemale')}</option></select></div></div>
  </form>
</div>
