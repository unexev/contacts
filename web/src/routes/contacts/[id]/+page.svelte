<script>
  import { A, api } from '$lib/api.svelte.js';
  import { currentContact, loading } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ArrowLeft, Pencil, Plus, Trash2, RefreshCw, Skull, X } from '@lucide/svelte';
  import { formatAge, formatAgeAt, parseContactDate } from '$lib/date.js';
  import { formatValue, formatPhone as formatPhoneBase, formatEmail, formatUrl, formatDate, formatSavedDate } from '$lib/format.js';
  import { resolveDocTypeLabel } from '$lib/docTypes.js';
  import { resolveCountryLabel } from '$lib/countries.js';

  let showDeleteModal = $state(false);
  let showAddMenu = $state(false);
  let deleting = $state(false);
  let error = $state('');

  let contactId = $derived($page.params.id);

  onMount(() => {
    if (!A.token) { goto('/'); return; }
    fetchContact();
  });

  async function fetchContact() {
    loading.value = true;
    error = '';
    try {
      const data = await api(`/api/contacts/${contactId}`);
      currentContact.value = data;
    } catch (err) {
      if (err.message === 'unauthorized') goto('/');
      error = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function deleteContact() {
    deleting = true;
    try {
      await api(`/api/contacts/${contactId}`, { method: 'DELETE' });
      goto('/contacts');
    } catch (err) {
      error = err.message;
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  }

  function editSection(section, add = false) {
    goto(`/contacts/${contactId}/edit?${add ? 'add' : 'section'}=${section}`);
  }

  function locationType(type) {
    const key = { birth: 'locationBirth', residence: 'locationResidence', work: 'locationWork', other: 'locationOther' }[type];
    return key ? t(key) : (type || t('locationTitle'));
  }

  function formatPhone(p) {
    if (typeof p === 'string') return p;
    const number = p.phone || p.number || p.value || '—';
    let label = '';
    if (typeof p.label === 'object' && p.label !== null) {
      label = p.label.Valid ? p.label.String : '';
    } else if (typeof p.label === 'string') {
      label = p.label;
    }
    return label ? `${number} (${label})` : number;
  }

  function docTypeLabel(type) {
    return resolveDocTypeLabel(type, t);
  }

  function sortedOrganizations(items) {
    return [...(items || [])].sort((a, b) => {
      const aDate = parseContactDate(a.date)?.getTime() || 0;
      const bDate = parseContactDate(b.date)?.getTime() || 0;
      return bDate - aDate;
    });
  }
</script>

<div class="detail-page animate-in">
  <div class="detail-header">
    <button class="btn-ghost" onclick={() => goto('/contacts')}>
      <ArrowLeft size={18} /> {t('contactBack')}
    </button>
    <div class="detail-header-actions">
      <button class="btn-ghost danger" onclick={() => showDeleteModal = true}>
        <Trash2 size={18} /> {t('contactDelete')}
      </button>
    </div>
  </div>

  {#if error}
    <div class="detail-error">{error}</div>
  {/if}

  {#if loading.value}
    <div class="empty-state">
      <RefreshCw class="spinning" size={48} />
    </div>
  {:else if currentContact.value}
    {@const c = currentContact.value}

    <div class="detail-avatar-section">
      <div class="detail-avatar">
         {#if c.deceased}
           <Skull size={38} strokeWidth={1.8} aria-label={t('contactDeceased')} />
         {:else}
           {(c.first_name || '')[0] || '?'}{(c.surname || '')[0] || ''}
         {/if}
      </div>
       <h1 class="detail-name">
         {c.first_name || ''} {c.middle_name || ''} {c.surname || ''}
       </h1>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">{t('contactPersonal')}</span>
        <button class="card-action" onclick={() => editSection('personal')}><Pencil size={16} /> Editar</button>
      </div>
      <div class="section-card-body">
         <div class="field-row">
          <span class="field-label">{t('contactFirstName')}</span>
          <span class="field-value">{formatValue(c.first_name)}</span>
         </div>
         {#if c.middle_name}
          <div class="field-row">
            <span class="field-label">{t('contactMiddleName')}</span>
            <span class="field-value">{formatValue(c.middle_name)}</span>
     </div>

         {/if}
        <div class="field-row">
          <span class="field-label">{t('contactSurname')}</span>
          <span class="field-value">{formatValue(c.surname)}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{t('contactBirthdate')}</span>
          <span class="field-value">{formatDate(c.birthdate)}{#if formatAge(c.birthdate)}<small class="field-helper">{formatAge(c.birthdate)}</small>{/if}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{t('contactGender')}</span>
          <span class="field-value">{formatValue(c.gender)}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{t('contactMaritalStatus')}</span>
          <span class="field-value">{formatValue(c.marital_status)}</span>
        </div>
     </div>
    </div>



    {#if c.phones?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactPhones')}</span>
          <button class="card-action" onclick={() => editSection('phone', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.phones as phone}
            <div class="detail-item">
              <div><span class:inactive-phone={!phone.is_active} class="field-value">{formatPhone(phone)}</span><small class="field-helper">{phone.is_active ? t('phoneInUse') : t('phoneNotInUse')}{#if phone.created_at} · {t('phoneSavedOn')} {formatSavedDate(phone.created_at)}{/if}</small></div>
              <button class="card-action icon-only" aria-label="Editar teléfono" onclick={() => editSection('phone')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.emails?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactEmails')}</span>
          <button class="card-action" onclick={() => editSection('email', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.emails as email}
            <div class="detail-item">
              <span class="field-value">{formatEmail(email)}</span>
              <button class="card-action icon-only" aria-label="Editar correo" onclick={() => editSection('email')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.urls?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactUrls')}</span>
          <button class="card-action" onclick={() => editSection('url', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.urls as url}
            <div class="detail-item">
              <span class="field-value">{formatUrl(url)}</span>
              <button class="card-action icon-only" aria-label="Editar URL" onclick={() => editSection('url')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.notes?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactNotes')}</span>
          <button class="card-action" onclick={() => editSection('note', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.notes as note}
            <div class="detail-item"><div class="notes-text">{note.note || note.text || formatValue(note)}</div><button class="card-action icon-only" aria-label="Editar nota" onclick={() => editSection('note')}><Pencil size={16} /></button></div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.keywords?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactKeywords')}</span>
          <button class="card-action" onclick={() => editSection('keyword', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          <div class="keywords-list">
            {#each c.keywords as kw}
              <span class="keyword-item"><span class="keyword-tag">{kw}</span><button class="card-action icon-only" aria-label="Editar palabra clave" onclick={() => editSection('keyword')}><Pencil size={16} /></button></span>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if c.identity_cards?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactIdentity')}</span>
          <button class="card-action" onclick={() => editSection('card', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.identity_cards as card}
            <div class="detail-item">
              <div style="display: flex; flex-direction: column; align-items: flex-start;">
                <span class="field-label">{docTypeLabel(card.doc_type || card.type)}</span>
                <span class="field-value">{card.card_number || card.number || card.value || '—'}</span>
                {#if (card.expiry_date && formatValue(card.expiry_date) !== '—') || (card.issue_date && formatValue(card.issue_date) !== '—')}
                  <small class="field-helper">
                    {#if card.issue_date && formatValue(card.issue_date) !== '—'}Emisión: {formatDate(card.issue_date)}{/if}
                    {#if card.expiry_date && formatValue(card.expiry_date) !== '—'} · Vencimiento: {formatDate(card.expiry_date)}{/if}
                  </small>
                {/if}
              </div>
              <button class="card-action icon-only" aria-label="Editar documento" onclick={() => editSection('card')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.bank_accounts?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactBank')}</span>
          <button class="card-action" onclick={() => editSection('bank', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.bank_accounts as acc}
            <div class="detail-item">
              <span class="field-label">{formatValue(acc.bank_name) !== '—' ? formatValue(acc.bank_name) : (acc.bank || acc.name || 'Account')}</span>
              <span class="field-value">{acc.account_number || acc.number || acc.iban || acc.value || '—'}</span>
              <button class="card-action icon-only" aria-label="Editar cuenta bancaria" onclick={() => editSection('bank')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.relationships?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactRelationships')}</span>
          <button class="card-action" onclick={() => editSection('relationship', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.relationships as rel}
            <div class="detail-item relation-item" role="button" tabindex="0"
                 onclick={() => rel.related_contact_id && goto(`/contacts/${rel.related_contact_id}`)}
                 onkeydown={(e) => e.key === 'Enter' && rel.related_contact_id && goto(`/contacts/${rel.related_contact_id}`)}>
              <div>
                <span class="field-label">{rel.type_label || rel.type_id || 'Contact'}</span>
                {#if rel.related_contact_id}
                  <a class="field-value related-contact" href={`/contacts/${rel.related_contact_id}`} onclick={(e) => e.stopPropagation()}>
                    {rel.related_contact_name || rel.contact_name || rel.name || rel.related_contact_id}
                  </a>
                {:else}
                  <span class="field-value">{rel.related_contact_name || rel.contact_name || rel.name || '—'}</span>
                {/if}
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <span class="related-arrow" aria-hidden="true">›</span>
                <button class="card-action icon-only" aria-label="Editar relación" onclick={(e) => { e.stopPropagation(); editSection('relationship'); }}><Pencil size={16} /></button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.organizations?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactOrganizations')}</span>
          <button class="card-action" onclick={() => editSection('organization', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
           {#each sortedOrganizations(c.organizations) as org}
             <div class="detail-item organization-item">
               <div class="organization-copy">
                 <strong>{formatValue(org.achievement || org.role || org.title)}</strong>
                 <span class="field-label">{org.organization_name || org.name || 'Organization'}</span>
                 {#if formatValue(org.date) !== '—'}
                   <small class="field-helper">{formatValue(org.date)}{#if formatAgeAt(c.birthdate, org.date)} · {formatAgeAt(c.birthdate, org.date)}{/if}</small>
                 {/if}
               </div>
              <button class="card-action icon-only" aria-label="Editar organización" onclick={() => editSection('organization')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('locationTitle')}</span>
          <button class="card-action" onclick={() => editSection('location', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.locations as location}
            <div class="detail-item">
              <div><span class="field-label">{locationType(location.location_type)}</span><span class="field-value location-value">{[location.address, location.city, location.region, location.country, location.postal_code].filter(Boolean).join(', ') || '—'}</span>{#if location.latitude !== null && location.longitude !== null}<small class="field-helper">{location.latitude}, {location.longitude}</small>{/if}</div>
              <button class="card-action icon-only" aria-label="Editar ubicación" onclick={() => editSection('location')}><Pencil size={16} /></button>
            </div>
          {/each}
          {#if !c.locations?.length}<div class="empty-section">{t('locationEmpty')}</div>{/if}
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('nationalityTitle')}</span>
          <button class="card-action" onclick={() => editSection('nationality', true)}><Plus size={16} /> Agregar</button>
        </div>
        <div class="section-card-body">
          {#each c.nationalities || [] as nat}
            <div class="detail-item">
              <div>
                <span class="field-label">{resolveCountryLabel(nat.country_code, t)}</span>
                {#if formatValue(nat.note) !== '—'}<span class="field-value location-value">{formatValue(nat.note)}</span>{/if}
                {#if formatValue(nat.acquired_at) !== '—'}<small class="field-helper">{formatDate(nat.acquired_at)}</small>{/if}
              </div>
              <button class="card-action icon-only" aria-label="Editar nacionalidad" onclick={() => editSection('nationality')}><Pencil size={16} /></button>
            </div>
          {/each}
          {#if !c.nationalities?.length}<div class="empty-section">{t('nationalityEmpty')}</div>{/if}
        </div>
      </div>

      <!-- Agregar datos - botón único al final, desplegable mobile-friendly -->
      <div class="add-data-footer">
        <button class="{showAddMenu ? 'btn btn-secondary' : 'btn btn-primary'} add-main-btn" class:is-open={showAddMenu} onclick={() => showAddMenu = !showAddMenu} aria-expanded={showAddMenu} aria-haspopup="menu">
          {#if showAddMenu}<X size={18} /> Cerrar{:else}<Plus size={18} /> Agregar{/if}
        </button>
        {#if showAddMenu}
          <div class="add-menu" role="menu">
            {#each [['phone', 'Teléfono'], ['email', 'Correo'], ['card', 'Documento'], ['organization', 'Organización'], ['location', 'Ubicación'], ['nationality', 'Nacionalidad'], ['url', 'Sitio web'], ['note', 'Nota'], ['keyword', 'Palabra clave'], ['bank', 'Cuenta bancaria'], ['relationship', 'Relación']] as item}
              <button class="add-menu-item" role="menuitem" onclick={() => { showAddMenu = false; editSection(item[0], true); }}>
                <Plus size={14} /> {item[1]}
              </button>
            {/each}
          </div>
        {/if}
      </div>
  {/if}
</div>

{#if showDeleteModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={() => showDeleteModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
  >
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <div class="modal-title">{t('contactDelete')}</div>
      <div class="modal-text">{t('contactDeleteHint')}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={() => showDeleteModal = false}>
          {t('contactCancel')}
        </button>
        <button class="btn btn-danger" onclick={deleteContact} disabled={deleting}>
          {deleting ? '...' : t('contactDelete')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .detail-page { padding-bottom: 40px; }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .detail-header-actions {
    display: flex;
    gap: 4px;
  }

  .card-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface2);
    color: var(--accent);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .card-action:hover { background: var(--surface); border-color: var(--accent); }
  .card-action.icon-only { width: 40px; padding: 8px; }

  .detail-item {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
  }

  .detail-item + .detail-item { border-top: 1px solid var(--border); }

  .location-value { display: block; text-align: left; margin-top: 3px; }
  .empty-section { padding: 8px 0; color: var(--text2); font-size: 14px; }
  .inactive-phone { color: var(--text2); text-decoration: line-through; }

  .keyword-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 4px 3px 12px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background: var(--surface2);
  }

  .keyword-item .keyword-tag { padding: 0; border: 0; background: transparent; }
  .keyword-item .card-action { min-height: 32px; width: 32px; padding: 5px; border: 0; background: transparent; }

  .btn-ghost.danger {
    color: var(--danger);
  }

  .detail-avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 28px;
  }

  .detail-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 12px;
  }

  .detail-name {
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    letter-spacing: -0.3px;
  }

  .deceased-status { color: var(--danger); }
  .add-data-footer { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  .add-main-btn { width: 100%; justify-content: center; min-height: 48px; font-size: 15px; gap: 8px; transition: all 0.2s ease; }
  .add-main-btn.is-open { background: var(--surface2) !important; border-color: var(--border) !important; color: var(--text2) !important; }
  .add-main-btn.is-open:hover { background: var(--surface) !important; color: var(--text) !important; border-color: var(--text2) !important; }
  .add-menu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; animation: fadeIn 0.15s ease; }
  .add-menu-item { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface2); color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; justify-content: flex-start; }
  .add-menu-item:hover { background: var(--surface); border-color: var(--accent); color: var(--accent); }
  .organization-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .organization-copy strong { font-size: 15px; color: var(--text); }
  .relation-item { cursor: pointer; border-radius: 10px; transition: background 0.15s ease; }
  .relation-item:hover { background: var(--surface2); }
  .relation-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .related-arrow { color: var(--text2); font-size: 20px; line-height: 1; padding: 0 4px; }

  .detail-error {
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 16px;
    text-align: center;
  }

  .notes-text {
    font-size: 15px;
    color: var(--text);
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .keywords-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .keyword-tag {
    padding: 4px 12px;
    background: var(--surface2);
    border-radius: 20px;
    font-size: 13px;
    color: var(--accent);
    border: 1px solid var(--border);
  }

  .field-helper { display: block; color: var(--text2); font-size: 12px; margin-top: 2px; }
  .related-contact { color: var(--accent); text-decoration: none; }
  .related-contact:hover { text-decoration: underline; }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 600px) {
    .detail-header { align-items: flex-start; }
    .detail-header-actions { flex-direction: column; }
    .card-action { min-height: 44px; }
    .detail-item { gap: 8px; }
  }

  @media (min-width: 600px) {
    .add-menu { grid-template-columns: repeat(3, 1fr); }
  }

  @media (min-width: 900px) {
    .add-menu { grid-template-columns: repeat(4, 1fr); }
  }
</style>
