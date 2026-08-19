<script>
  import { A, api } from '$lib/api.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Trash2 } from '@lucide/svelte';
  import RelatedSection from '$lib/components/RelatedSection.svelte';
  import { parseContactDate } from '$lib/date.js';

  let id = $derived($page.params.id);
  let first_name = $state('');
  let middle_name = $state('');
  let surname = $state('');
  let birthdate = $state('');
  let gender = $state('');
  let marital_status = $state('');
  let maritalStatuses = $state([]);
  let phones = $state([]);
  let emails = $state([]);
  let urls = $state([]);
  let notes = $state([]);
  let keywords = $state([]);
  let cards = $state([]);
  let bankAccounts = $state([]);
  let relationships = $state([]);
  let organizations = $state([]);
  let original = $state({ phones: [], emails: [], urls: [], notes: [], cards: [], bankAccounts: [], organizations: [], keywords: [], relationships: [] });
  let error = $state('');
  let saving = $state(false);

  const value = (item, key) => {
    const value = item?.[key];
    return value && typeof value === 'object' ? (value.Valid ? value.String : '') : (value || '');
  };

  function dateInput(value) {
    const date = parseContactDate(value);
    return date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : '';
  }

  function normalizeList(list, fields) {
    return (list || []).map(item => Object.fromEntries([
      ...Object.entries(item),
      ...fields.map(field => [field, value(item, field)])
    ]));
  }

  function removeAt(list, index) {
    list.splice(index, 1);
    list = [...list];
  }

  function addPhone() { phones = [...phones, { phone: '', label: '' }]; }
  function addEmail() { emails = [...emails, { email: '', label: '' }]; }
  function addUrl() { urls = [...urls, { url: '', label: '' }]; }
  function addNote() { notes = [...notes, { note: '' }]; }
  function addKeyword() { keywords = [...keywords, '']; }
  function addCard() { cards = [...cards, { doc_type: '', card_number: '', issue_date: '', expiry_date: '' }]; }
  function addBank() { bankAccounts = [...bankAccounts, { bank_name: '', account_number: '', account_type: '', label: '' }]; }
  function addRelationship() { relationships = [...relationships, { related_contact_id: '', type_id: '' }]; }
  function addOrganization() { organizations = [...organizations, { organization_id: '', achievement: '', date: '' }]; }

  onMount(async () => {
    if (!A.token) return goto('/');
    try {
      const [c, statuses] = await Promise.all([api(`/api/contacts/${id}`), api('/api/marital-statuses')]);
      maritalStatuses = Array.isArray(statuses) ? statuses : (statuses?.statuses || []);
      first_name = c.first_name || ''; middle_name = c.middle_name || ''; surname = c.surname || '';
      birthdate = dateInput(c.birthdate);
      gender = c.gender || '';
      marital_status = c.status_id || '';
      phones = normalizeList(c.phones, ['phone', 'label']);
      emails = normalizeList(c.emails, ['email', 'label']);
      urls = normalizeList(c.urls, ['url', 'label']);
      notes = normalizeList(c.notes, ['note']);
      keywords = (c.keywords || []).map(k => typeof k === 'string' ? k : k.keyword || '');
      cards = normalizeList(c.identity_cards, ['doc_type', 'card_number', 'issue_date', 'expiry_date']).map(card => ({ ...card, issue_date: dateInput(card.issue_date), expiry_date: dateInput(card.expiry_date) }));
      bankAccounts = normalizeList(c.bank_accounts, ['bank_name', 'account_number', 'account_type', 'label']);
      relationships = normalizeList(c.relationships, ['related_contact_id', 'type_id']);
      organizations = normalizeList(c.organizations, ['organization_id', 'achievement', 'date']).map(org => ({ ...org, date: dateInput(org.date) }));
      original = {
        phones: phones.map(x => x.phone_id).filter(Boolean), emails: emails.map(x => x.email_id).filter(Boolean),
        urls: urls.map(x => x.url_id).filter(Boolean), notes: notes.map(x => x.note_id).filter(Boolean),
        cards: cards.map(x => x.card_id).filter(Boolean), bankAccounts: bankAccounts.map(x => x.bank_account_id).filter(Boolean),
        organizations: organizations.map(x => x.organization_id).filter(Boolean), keywords: [...keywords],
        relationships: relationships.map(x => ({ related_contact_id: x.related_contact_id, type_id: x.type_id }))
      };
    } catch (e) { error = e.message; }
  });

  async function saveCollection(items, oldIds, path, idKey) {
    const currentIds = items.map(item => item[idKey]).filter(Boolean);
    await Promise.all(oldIds.filter(itemId => !currentIds.includes(itemId)).map(itemId => api(`${path}/${itemId}`, { method: 'DELETE' })));
    await Promise.all(items.map(item => api(item[idKey] ? `${path}/${item[idKey]}` : path, { method: item[idKey] ? 'PUT' : 'POST', body: item })));
  }

  async function saveKeywords() {
    await Promise.all(original.keywords.filter(keyword => !keywords.includes(keyword)).map(keyword => api(`/api/contacts/${id}/keywords/${encodeURIComponent(keyword)}`, { method: 'DELETE' })));
    await Promise.all(keywords.filter(keyword => keyword.trim() && !original.keywords.includes(keyword)).map(keyword => api(`/api/contacts/${id}/keywords`, { method: 'POST', body: { keyword: keyword.trim() } })));
  }

  async function saveRelationships() {
    await Promise.all(original.relationships.filter(rel => rel.related_contact_id && rel.type_id).map(rel => api(`/api/contacts/${id}/relationships/${rel.related_contact_id}?typeId=${encodeURIComponent(rel.type_id)}`, { method: 'DELETE' })));
    await Promise.all(relationships.filter(rel => rel.related_contact_id && rel.type_id).map(rel => api(`/api/contacts/${id}/relationships`, { method: 'POST', body: rel })));
  }

  async function save(e) {
    e.preventDefault(); error = '';
    if (!first_name.trim() || !surname.trim()) { error = 'Nombre y apellido son obligatorios'; return; }
    saving = true;
    try {
      await api(`/api/contacts/${id}`, { method: 'PUT', body: { first_name, middle_name, surname, birthdate, gender, status_id: marital_status } });
      await Promise.all([
        saveCollection(phones, original.phones, `/api/contacts/${id}/phones`, 'phone_id'),
        saveCollection(emails, original.emails, `/api/contacts/${id}/emails`, 'email_id'),
        saveCollection(urls, original.urls, `/api/contacts/${id}/urls`, 'url_id'),
        saveCollection(notes, original.notes, `/api/contacts/${id}/notes`, 'note_id'),
        saveCollection(cards, original.cards, `/api/contacts/${id}/cards`, 'card_id'),
        saveCollection(bankAccounts, original.bankAccounts, `/api/contacts/${id}/bank-accounts`, 'bank_account_id'),
        saveCollection(organizations, original.organizations, `/api/contacts/${id}/organizations`, 'organization_id'),
        saveKeywords(), saveRelationships()
      ]);
      goto(`/contacts/${id}`);
    } catch (e) { error = e.message; } finally { saving = false; }
  }
</script>

<div class="new-contact-page animate-in">
  <div class="form-header"><button class="btn-ghost" onclick={() => goto(`/contacts/${id}`)}>{t('contactCancel')}</button><h1 class="form-title">{t('contactEdit')}</h1><button class="btn-ghost" onclick={save} disabled={saving}>{saving ? '...' : t('contactSave')}</button></div>
  {#if error}<div class="form-error-banner">{error}</div>{/if}
  <form onsubmit={save}>
    <div class="form-card"><h2 class="form-section-title">Datos personales</h2><div class="form-group"><label class="form-label" for="first_name">{t('contactFirstName')} *</label><input id="first_name" class="input" bind:value={first_name} /></div><div class="form-group"><label class="form-label" for="middle_name">{t('contactMiddleName')}</label><input id="middle_name" class="input" bind:value={middle_name} /></div><div class="form-group"><label class="form-label" for="surname">{t('contactSurname')} *</label><input id="surname" class="input" bind:value={surname} /></div><div class="form-group"><label class="form-label" for="birthdate">{t('contactBirthdate')}</label><input id="birthdate" class="input" type="date" bind:value={birthdate} /></div><div class="form-group"><label class="form-label" for="gender">{t('contactGender')}</label><select id="gender" class="select" bind:value={gender}><option value="">{t('contactGenderUnspecified')}</option><option value="MALE">{t('contactGenderMale')}</option><option value="FEMALE">{t('contactGenderFemale')}</option></select></div><div class="form-group"><label class="form-label" for="marital_status">{t('contactMaritalStatus')}</label><select id="marital_status" class="select" bind:value={marital_status}><option value="">—</option>{#each maritalStatuses as status}<option value={status.status_id}>{status.marital_status}</option>{/each}</select></div></div>

    <RelatedSection title="Teléfonos" add={addPhone}>
      {#each phones as phone, i}<div class="related-row"><input class="input" placeholder="Teléfono" bind:value={phone.phone} /><input class="input" placeholder="Etiqueta" bind:value={phone.label} /><button type="button" class="icon-button danger" aria-label="Eliminar teléfono" onclick={() => removeAt(phones, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Correos" add={addEmail}>
      {#each emails as email, i}<div class="related-row"><input class="input" type="email" placeholder="Correo" bind:value={email.email} /><input class="input" placeholder="Etiqueta" bind:value={email.label} /><button type="button" class="icon-button danger" aria-label="Eliminar correo" onclick={() => removeAt(emails, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="URLs" add={addUrl}>
      {#each urls as url, i}<div class="related-row"><input class="input" placeholder="URL" bind:value={url.url} /><input class="input" placeholder="Etiqueta" bind:value={url.label} /><button type="button" class="icon-button danger" aria-label="Eliminar URL" onclick={() => removeAt(urls, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Notas" add={addNote}>
      {#each notes as note, i}<div class="related-row"><textarea class="input" rows="2" placeholder="Nota" bind:value={note.note}></textarea><button type="button" class="icon-button danger" aria-label="Eliminar nota" onclick={() => removeAt(notes, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Palabras clave" add={addKeyword}>
      {#each keywords as keyword, i}<div class="related-row"><input class="input" placeholder="Palabra clave" bind:value={keywords[i]} /><button type="button" class="icon-button danger" aria-label="Eliminar palabra clave" onclick={() => removeAt(keywords, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Documentos de identidad" add={addCard}>
      {#each cards as card, i}<div class="related-grid"><input class="input" placeholder="Tipo" bind:value={card.doc_type} /><input class="input" placeholder="Número" bind:value={card.card_number} /><input class="input" type="date" bind:value={card.issue_date} /><input class="input" type="date" bind:value={card.expiry_date} /><button type="button" class="icon-button danger" aria-label="Eliminar documento" onclick={() => removeAt(cards, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Cuentas bancarias" add={addBank}>
      {#each bankAccounts as account, i}<div class="related-grid"><input class="input" placeholder="Banco" bind:value={account.bank_name} /><input class="input" placeholder="Número de cuenta" bind:value={account.account_number} /><input class="input" placeholder="Tipo" bind:value={account.account_type} /><input class="input" placeholder="Etiqueta" bind:value={account.label} /><button type="button" class="icon-button danger" aria-label="Eliminar cuenta" onclick={() => removeAt(bankAccounts, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Relaciones" add={addRelationship}>
      {#each relationships as relation, i}<div class="related-grid"><input class="input" placeholder="ID del contacto relacionado" bind:value={relation.related_contact_id} /><input class="input" placeholder="ID del tipo de relación" bind:value={relation.type_id} /><button type="button" class="icon-button danger" aria-label="Eliminar relación" onclick={() => removeAt(relationships, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
    <RelatedSection title="Organizaciones" add={addOrganization}>
      {#each organizations as organization, i}<div class="related-grid"><input class="input" placeholder="ID de organización" bind:value={organization.organization_id} /><input class="input" placeholder="Logro o cargo" bind:value={organization.achievement} /><input class="input" type="date" bind:value={organization.date} /><button type="button" class="icon-button danger" aria-label="Eliminar organización" onclick={() => removeAt(organizations, i)}><Trash2 size={16} /></button></div>{/each}
    </RelatedSection>
  </form>
</div>

<style>
  .related-row, .related-grid { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 8px; }
  .related-grid { grid-template-columns: repeat(4, 1fr) auto; }
  textarea.input { resize: vertical; }
  .icon-button { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--text2); cursor: pointer; }
  .icon-button.danger:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
  @media (max-width: 600px) { .related-row, .related-grid { grid-template-columns: 1fr auto; } .related-row .input:first-child, .related-grid .input:first-child { grid-column: 1 / -1; } }
</style>
