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
  let selectedSection = $derived($page.url.searchParams.get('section') || $page.url.searchParams.get('add') || '');
  let editTitle = $derived(selectedSection ? ({ personal: 'Información personal', phone: 'Teléfonos', email: 'Correos', url: 'URLs', note: 'Notas', keyword: 'Palabras clave', card: 'Documentos de identidad', bank: 'Cuentas bancarias', relationship: 'Relaciones', organization: 'Organizaciones', location: 'Ubicaciones' }[selectedSection] || selectedSection) : t('contactEdit'));
  let first_name = $state('');
  let middle_name = $state('');
  let surname = $state('');
  let birthdate = $state('');
  let gender = $state('');
   let marital_status = $state('');
   let deceased = $state(false);
  let maritalStatuses = $state([]);
  let availableOrgs = $state([]);
  let availableContacts = $state([]);
  let relationshipTypes = $state([]);
  let phones = $state([]);
  let emails = $state([]);
  let urls = $state([]);
  let notes = $state([]);
  let keywords = $state([]);
  let cards = $state([]);
  let bankAccounts = $state([]);
  let relationships = $state([]);
  let organizations = $state([]);
  let locations = $state([]);
  let original = $state({ phones: [], emails: [], urls: [], notes: [], cards: [], bankAccounts: [], organizations: [], locations: [], keywords: [], relationships: [] });
  let error = $state('');
  let saving = $state(false);
  const documentTypes = [
    { value: 'national_id', label: 'docTypeNationalId' },
    { value: 'passport', label: 'docTypePassport' },
    { value: 'drivers_license', label: 'docTypeDriversLicense' },
    { value: 'residence_permit', label: 'docTypeResidencePermit' },
    { value: 'other', label: 'docTypeOther' }
  ];

  function documentTypeValue(type) {
    return ({
      'Cédula': 'national_id',
      'ID Card': 'national_id',
      'Pasaporte': 'passport',
      'Passport': 'passport',
      'Licencia de conducir': 'drivers_license'
    }[type] || type || '');
  }

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

  function addPhone() { phones = [...phones, { phone: '', label: '', is_active: true, created_at: 0 }]; }
  function addEmail() { emails = [...emails, { email: '', label: '' }]; }
  function addUrl() { urls = [...urls, { url: '', label: '' }]; }
  function addNote() { notes = [...notes, { note: '' }]; }
  function addKeyword() { keywords = [...keywords, '']; }
  function addCard() { cards = [...cards, { doc_type: '', card_number: '', issue_date: '', expiry_date: '' }]; }
  function addBank() { bankAccounts = [...bankAccounts, { bank_name: '', account_number: '', account_type: '', label: '' }]; }
  function addRelationship() { relationships = [...relationships, { related_contact_id: '', type_id: '' }]; }
  function addOrganization() { organizations = [...organizations, { organization_id: '', organization_name: '', newName: '', achievement: '', date: '' }]; }
  function addLocation() { locations = [...locations, { location_type: 'residence', address: '', city: '', region: '', country: '', postal_code: '', latitude: null, longitude: null }]; }

  onMount(async () => {
    if (!A.token) return goto('/');
    try {
      const [c, statuses, orgs, relTypes, contactsData] = await Promise.all([
        api(`/api/contacts/${id}`),
        api('/api/marital-statuses'),
        api('/api/organizations').catch(() => []),
        api('/api/relationship-types').catch(() => []),
        api('/api/contacts?limit=100').catch(() => ({ data: [] }))
      ]);
      maritalStatuses = Array.isArray(statuses) ? statuses : (statuses?.statuses || []);
      availableOrgs = Array.isArray(orgs) ? orgs : (orgs?.data || orgs?.organizations || []);
      relationshipTypes = Array.isArray(relTypes) ? relTypes : (relTypes?.data || relTypes?.types || []);
      const contactsList = contactsData?.data || contactsData?.contacts || (Array.isArray(contactsData) ? contactsData : []);
      availableContacts = contactsList.filter(contact => contact.contact_id !== id).map(contact => ({
        id: contact.contact_id,
        label: `${contact.first_name || ''} ${contact.middle_name || ''} ${contact.surname || ''}`.trim() || contact.contact_id
      }));
      first_name = c.first_name || ''; middle_name = c.middle_name || ''; surname = c.surname || '';
      birthdate = dateInput(c.birthdate);
      gender = c.gender || '';
       marital_status = c.status_id || '';
       deceased = c.deceased === true;
      phones = normalizeList(c.phones, ['phone', 'label', 'created_at', 'is_active']).map(phone => ({ ...phone, is_active: phone.is_active !== false }));
      emails = normalizeList(c.emails, ['email', 'label']);
      urls = normalizeList(c.urls, ['url', 'label']);
      notes = normalizeList(c.notes, ['note']);
      keywords = (c.keywords || []).map(k => typeof k === 'string' ? k : k.keyword || '');
      cards = normalizeList(c.identity_cards, ['doc_type', 'card_number', 'issue_date', 'expiry_date']).map(card => ({ ...card, doc_type: documentTypeValue(card.doc_type), issue_date: dateInput(card.issue_date), expiry_date: dateInput(card.expiry_date) }));
      bankAccounts = normalizeList(c.bank_accounts, ['bank_name', 'account_number', 'account_type', 'label']);
      relationships = normalizeList(c.relationships, ['related_contact_id', 'type_id']);
      organizations = normalizeList(c.organizations, ['organization_id', 'organization_name', 'achievement', 'date']).map(org => ({ ...org, date: dateInput(org.date), newName: '' }));
      locations = normalizeList(c.locations, ['location_type', 'address', 'city', 'region', 'country', 'postal_code', 'latitude', 'longitude']);
      original = {
        phones: phones.map(x => x.phone_id).filter(Boolean), emails: emails.map(x => x.email_id).filter(Boolean),
        urls: urls.map(x => x.url_id).filter(Boolean), notes: notes.map(x => x.note_id).filter(Boolean),
        cards: cards.map(x => x.card_id).filter(Boolean), bankAccounts: bankAccounts.map(x => x.bank_account_id).filter(Boolean),
        organizations: organizations.map(x => x.organization_id).filter(Boolean), keywords: [...keywords],
        locations: locations.map(x => x.location_id).filter(Boolean),
        relationships: relationships.map(x => ({ related_contact_id: x.related_contact_id, type_id: x.type_id }))
      };

      const addSection = $page.url.searchParams.get('add');
      if (addSection === 'phone') addPhone();
      if (addSection === 'email') addEmail();
      if (addSection === 'url') addUrl();
      if (addSection === 'note') addNote();
      if (addSection === 'keyword') addKeyword();
      if (addSection === 'card') addCard();
      if (addSection === 'bank') addBank();
      if (addSection === 'relationship') addRelationship();
      if (addSection === 'organization') addOrganization();
      if (addSection === 'location') addLocation();
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
      // Resolver organizaciones nuevas creadas desde el formulario
      for (let org of organizations) {
        if (org.organization_id === '__new' && org.newName?.trim()) {
          const created = await api('/api/organizations', { method: 'POST', body: { name: org.newName.trim() } });
          const newId = created?.organization_id || created?.data?.organization_id || created?.id;
          if (newId) {
            org.organization_id = newId;
            org.organization_name = org.newName.trim();
            availableOrgs = [...availableOrgs, { organization_id: newId, name: org.newName.trim() }];
          }
          org.newName = '';
        }
      }
      // Si el usuario escribió directamente nombre sin seleccionar, intentar matchear
      for (let org of organizations) {
        if (!org.organization_id && org.organization_name?.trim()) {
          const match = availableOrgs.find(o => o.name.toLowerCase() === org.organization_name.trim().toLowerCase());
          if (match) org.organization_id = match.organization_id;
          else {
            const created = await api('/api/organizations', { method: 'POST', body: { name: org.organization_name.trim() } });
            const newId = created?.organization_id || created?.data?.organization_id;
            if (newId) org.organization_id = newId;
          }
        }
      }
      const saves = [];
      if (!selectedSection || selectedSection === 'personal') {
         saves.push(api(`/api/contacts/${id}`, { method: 'PUT', body: { first_name, middle_name, surname, birthdate, gender, status_id: marital_status, deceased } }));
      }
      if (!selectedSection || selectedSection === 'phone') saves.push(saveCollection(phones, original.phones, `/api/contacts/${id}/phones`, 'phone_id'));
      if (!selectedSection || selectedSection === 'email') saves.push(saveCollection(emails, original.emails, `/api/contacts/${id}/emails`, 'email_id'));
      if (!selectedSection || selectedSection === 'url') saves.push(saveCollection(urls, original.urls, `/api/contacts/${id}/urls`, 'url_id'));
      if (!selectedSection || selectedSection === 'note') saves.push(saveCollection(notes, original.notes, `/api/contacts/${id}/notes`, 'note_id'));
      if (!selectedSection || selectedSection === 'card') saves.push(saveCollection(cards, original.cards, `/api/contacts/${id}/cards`, 'card_id'));
      if (!selectedSection || selectedSection === 'bank') saves.push(saveCollection(bankAccounts, original.bankAccounts, `/api/contacts/${id}/bank-accounts`, 'bank_account_id'));
      if (!selectedSection || selectedSection === 'organization') {
        const currentOrgIds = organizations.filter(o => o.organization_id && o.organization_id !== '__new').map(o => o.organization_id);
        const orgDeletes = original.organizations.filter(oldId => !currentOrgIds.includes(oldId)).map(oldId => api(`/api/contacts/${id}/organizations/${oldId}`, { method: 'DELETE' }));
        const orgUpserts = organizations.filter(o => o.organization_id && o.organization_id !== '__new').map(org => {
          const isExisting = original.organizations.includes(org.organization_id);
          const path = isExisting ? `/api/contacts/${id}/organizations/${org.organization_id}` : `/api/contacts/${id}/organizations`;
          const method = isExisting ? 'PUT' : 'POST';
          const body = { organization_id: org.organization_id, achievement: org.achievement || '', date: org.date || '' };
          return api(path, { method, body });
        });
        saves.push(Promise.all([...orgDeletes, ...orgUpserts]));
      }
      if (!selectedSection || selectedSection === 'location') saves.push(saveCollection(locations, original.locations, `/api/contacts/${id}/locations`, 'location_id'));
      if (!selectedSection || selectedSection === 'keyword') saves.push(saveKeywords());
      if (!selectedSection || selectedSection === 'relationship') saves.push(saveRelationships());
      await Promise.all(saves);
      goto(`/contacts/${id}`);
    } catch (e) { error = e.message; } finally { saving = false; }
  }
</script>

<div class="new-contact-page animate-in">
  <div class="form-header"><button class="btn-ghost" onclick={() => goto(`/contacts/${id}`)}>{t('contactCancel')}</button><h1 class="form-title">{selectedSection ? `Editar ${editTitle}` : editTitle}</h1><button class="btn-ghost" onclick={save} disabled={saving}>{saving ? '...' : t('contactSave')}</button></div>
  {#if error}<div class="form-error-banner">{error}</div>{/if}
  <form onsubmit={save}>
     {#if !selectedSection || selectedSection === 'personal'}
    <div class="form-card"><h2 class="form-section-title">Datos personales</h2><div class="form-group"><label class="form-label" for="first_name">{t('contactFirstName')} *</label><input id="first_name" class="input" bind:value={first_name} /></div><div class="form-group"><label class="form-label" for="middle_name">{t('contactMiddleName')}</label><input id="middle_name" class="input" bind:value={middle_name} /></div><div class="form-group"><label class="form-label" for="surname">{t('contactSurname')} *</label><input id="surname" class="input" bind:value={surname} /></div><div class="form-group"><label class="form-label" for="birthdate">{t('contactBirthdate')}</label><input id="birthdate" class="input" type="date" bind:value={birthdate} /></div><div class="form-group"><label class="form-label" for="gender">{t('contactGender')}</label><select id="gender" class="select" bind:value={gender}><option value="">{t('contactGenderUnspecified')}</option><option value="MALE">{t('contactGenderMale')}</option><option value="FEMALE">{t('contactGenderFemale')}</option></select></div><div class="form-group"><label class="form-label" for="marital_status">{t('contactMaritalStatus')}</label><select id="marital_status" class="select" bind:value={marital_status}><option value="">—</option>{#each maritalStatuses as status}<option value={status.status_id}>{status.marital_status}</option>{/each}</select></div></div>
     <label class="deceased-toggle"><input type="checkbox" bind:checked={deceased} /> {t('contactDeceased')}</label>
     {/if}

    {#if !selectedSection || selectedSection === 'phone'}
    <RelatedSection title="Teléfonos" add={addPhone}>
      {#each phones as phone, i}<div class="related-item"><div class="related-row"><input class="input" placeholder="Teléfono" bind:value={phone.phone} /><input class="input" placeholder="Etiqueta" bind:value={phone.label} /><button type="button" class="icon-button danger" aria-label="Eliminar teléfono" onclick={() => removeAt(phones, i)}><Trash2 size={16} /></button></div><label class="phone-status"><input type="checkbox" bind:checked={phone.is_active} /> {phone.is_active ? t('phoneInUse') : t('phoneNotInUse')}</label></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'email'}
    <RelatedSection title="Correos" add={addEmail}>
      {#each emails as email, i}<div class="related-item"><div class="related-row"><input class="input" type="email" placeholder="Correo" bind:value={email.email} /><input class="input" placeholder="Etiqueta" bind:value={email.label} /><button type="button" class="icon-button danger" aria-label="Eliminar correo" onclick={() => removeAt(emails, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'url'}
    <RelatedSection title="URLs" add={addUrl}>
      {#each urls as url, i}<div class="related-item"><div class="related-row"><input class="input" placeholder="URL" bind:value={url.url} /><input class="input" placeholder="Etiqueta" bind:value={url.label} /><button type="button" class="icon-button danger" aria-label="Eliminar URL" onclick={() => removeAt(urls, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'note'}
    <RelatedSection title="Notas" add={addNote}>
      {#each notes as note, i}<div class="related-item"><div class="related-row"><textarea class="input" rows="2" placeholder="Nota" bind:value={note.note}></textarea><button type="button" class="icon-button danger" aria-label="Eliminar nota" onclick={() => removeAt(notes, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'keyword'}
    <RelatedSection title="Palabras clave" add={addKeyword}>
      {#each keywords as keyword, i}<div class="related-item"><div class="related-row"><input class="input" placeholder="Palabra clave" bind:value={keywords[i]} /><button type="button" class="icon-button danger" aria-label="Eliminar palabra clave" onclick={() => removeAt(keywords, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'card'}
    <RelatedSection title="Documentos de identidad" add={addCard}>
      {#each cards as card, i}<div class="related-item"><div class="related-grid"><select class="select" aria-label={t('docTypeLabel')} bind:value={card.doc_type}><option value="">{t('docTypeSelect')}</option>{#if card.doc_type && !documentTypes.some(type => type.value === card.doc_type)}<option value={card.doc_type}>{card.doc_type}</option>{/if}{#each documentTypes as type}<option value={type.value}>{t(type.label)}</option>{/each}</select><input class="input" placeholder="Número" bind:value={card.card_number} /><input class="input" type="date" bind:value={card.issue_date} /><input class="input" type="date" bind:value={card.expiry_date} /><button type="button" class="icon-button danger" aria-label="Eliminar documento" onclick={() => removeAt(cards, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'bank'}
    <RelatedSection title="Cuentas bancarias" add={addBank}>
      {#each bankAccounts as account, i}<div class="related-item"><div class="related-grid"><input class="input" placeholder="Banco" bind:value={account.bank_name} /><input class="input" placeholder="Número de cuenta" bind:value={account.account_number} /><input class="input" placeholder="Tipo" bind:value={account.account_type} /><input class="input" placeholder="Etiqueta" bind:value={account.label} /><button type="button" class="icon-button danger" aria-label="Eliminar cuenta" onclick={() => removeAt(bankAccounts, i)}><Trash2 size={16} /></button></div></div>{/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'relationship'}
    <RelatedSection title="Relaciones" add={addRelationship}>
      <p class="form-hint" style="margin:-4px 0 8px; color:var(--text2); font-size:13px;">Selecciona el contacto y el tipo de relación (ej: Hermano, Padre).</p>
      {#each relationships as relation, i}
        <div class="related-item">
          <div class="related-grid">
            <select class="select" bind:value={relation.related_contact_id} aria-label="Contacto relacionado">
              <option value="">-- Selecciona contacto --</option>
              {#each availableContacts as contact}
                <option value={contact.id}>{contact.label}</option>
              {/each}
            </select>
            <select class="select" bind:value={relation.type_id} aria-label="Tipo de relación">
              <option value="">-- Tipo --</option>
              {#each relationshipTypes as rt}
                <option value={rt.type_id}>{rt.label}</option>
              {/each}
              {#if relationshipTypes.length === 0}
                <option value="padre">Padre</option><option value="madre">Madre</option><option value="hermano">Hermano</option><option value="hermana">Hermana</option><option value="hijo">Hijo</option><option value="hija">Hija</option>
              {/if}
            </select>
            <button type="button" class="icon-button danger" aria-label="Eliminar relación" onclick={() => removeAt(relationships, i)}><Trash2 size={16} /></button>
          </div>
          {#if relation.related_contact_id}
            <small style="color:var(--text2); font-size:12px;">{availableContacts.find(c => c.id === relation.related_contact_id)?.label || relation.related_contact_id}</small>
          {/if}
        </div>
      {/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'organization'}
    <RelatedSection title="Organizaciones" add={addOrganization}>
      <p class="form-hint" style="margin: -4px 0 8px; color: var(--text2); font-size: 13px;">Selecciona una organización existente o crea una nueva. «Logro» es el título/cargo obtenido y «Fecha» cuando lo obtuviste.</p>
      {#each organizations as organization, i}
        <div class="related-item">
          <div class="related-grid">
            <select class="select" bind:value={organization.organization_id} aria-label="Organización">
              <option value="">-- Selecciona organización --</option>
              {#each availableOrgs as org}
                <option value={org.organization_id}>{org.name}</option>
              {/each}
              <option value="__new">+ Crear nueva organización...</option>
            </select>
            {#if organization.organization_id === '__new'}
              <input class="input" placeholder="Nombre nueva organización (ej: Universidad Católica)" bind:value={organization.newName} />
            {:else}
              <input class="input" placeholder="Título, cargo o logro (ej: Bachiller, Ingeniero)" bind:value={organization.achievement} />
            {/if}
            <input class="input" type="date" bind:value={organization.date} title="Fecha del logro" />
            <button type="button" class="icon-button danger" aria-label="Eliminar organización" onclick={() => removeAt(organizations, i)}><Trash2 size={16} /></button>
          </div>
          {#if organization.organization_id === '__new'}
            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-top: 8px;">
              <span style="grid-column: 1; color: var(--text2); font-size: 12px; align-self: center;">{organization.organization_name ? `Actual: ${organization.organization_name}` : ''}</span>
              <input class="input" placeholder="Título, cargo o logro" bind:value={organization.achievement} />
              <span></span>
            </div>
            <small style="color: var(--text2); font-size: 12px;">Se creará la organización al guardar.</small>
          {:else if organization.organization_name}
            <small style="color: var(--text2); font-size: 12px;">{organization.organization_name} {#if organization.organization_id}· {organization.organization_id.slice(0,12)}…{/if}</small>
          {/if}
        </div>
      {/each}
    </RelatedSection>
    {/if}
    {#if !selectedSection || selectedSection === 'location'}
    <RelatedSection title={t('locationTitle')} add={addLocation}>
      {#each locations as location, i}<div class="related-item"><div class="related-grid location-grid"><select class="select" aria-label={t('locationTypeLabel')} bind:value={location.location_type}><option value="">{t('locationTypeSelect')}</option><option value="birth">{t('locationBirth')}</option><option value="residence">{t('locationResidence')}</option><option value="work">{t('locationWork')}</option><option value="other">{t('locationOther')}</option></select><input class="input" placeholder={t('locationAddress')} bind:value={location.address} /><input class="input" placeholder={t('locationCity')} bind:value={location.city} /><input class="input" placeholder={t('locationCountry')} bind:value={location.country} /><button type="button" class="icon-button danger" aria-label="Eliminar ubicación" onclick={() => removeAt(locations, i)}><Trash2 size={16} /></button></div><input class="input location-extra" placeholder={t('locationRegion')} bind:value={location.region} /><input class="input location-extra" placeholder={t('locationPostalCode')} bind:value={location.postal_code} /><div class="coordinates"><input class="input" type="number" step="any" min="-90" max="90" placeholder={t('locationLatitude')} bind:value={location.latitude} /><input class="input" type="number" step="any" min="-180" max="180" placeholder={t('locationLongitude')} bind:value={location.longitude} /></div></div>{/each}
    </RelatedSection>
    {/if}
  </form>
</div>

<style>
  .related-item {
    padding: 12px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .related-row, .related-grid { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 8px; }
  .related-grid { grid-template-columns: repeat(4, 1fr) auto; }
  textarea.input { resize: vertical; }
  .icon-button { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--text2); cursor: pointer; }
  .icon-button.danger:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
   .phone-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--text2); font-size: 14px; cursor: pointer; }
   .deceased-toggle { display: inline-flex; align-items: center; gap: 8px; color: var(--text2); font-size: 14px; cursor: pointer; }
  .phone-status input { width: 18px; height: 18px; accent-color: var(--accent); }
  .coordinates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  @media (max-width: 600px) { .related-row, .related-grid { grid-template-columns: 1fr auto; } .related-row .input:first-child, .related-grid .input:first-child { grid-column: 1 / -1; } .coordinates { grid-template-columns: 1fr; } }
</style>
