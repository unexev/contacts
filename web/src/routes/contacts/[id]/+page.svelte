<script>
  import { A, api } from '$lib/api.svelte.js';
  import { currentContact, loading } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ArrowLeft, Pencil, Plus, Trash2, RefreshCw, User } from '@lucide/svelte';
  import { formatAge, formatAgeAt, parseContactDate } from '$lib/date.js';

  let showDeleteModal = $state(false);
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

  function formatValue(val) {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'object') {
      if (val.Valid !== undefined) return val.Valid && val.String ? val.String : '—';
      if (val.time) return val.time;
      return '—';
    }
    return String(val);
  }

  function formatPhone(p) {
    if (typeof p === 'string') return p;
    return p.phone || p.number || p.value || '—';
  }

  function formatEmail(e) {
    if (typeof e === 'string') return e;
    return e.email || e.address || e.value || '—';
  }

  function formatUrl(u) {
    if (typeof u === 'string') return u;
    return u.url || u.value || '—';
  }

  function formatDate(d) {
    if (!d) return '—';
    try {
      let dateStr = d;
      if (typeof d === 'object' && d !== null) {
        if (d.Valid && d.String) {
          dateStr = d.String;
        } else if (d.time) {
          dateStr = d.time;
        } else {
          return '—';
        }
      }
      if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return '—';
      const date = parseContactDate(dateStr);
      if (!date) return '—';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '—';
    }
  }

  function formatSavedDate(timestamp) {
    const date = new Date(Number(timestamp));
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  }

  function editSection(section, add = false) {
    goto(`/contacts/${contactId}/edit?${add ? 'add' : 'section'}=${section}`);
  }

  function locationType(type) {
    const key = { birth: 'locationBirth', residence: 'locationResidence', work: 'locationWork', other: 'locationOther' }[type];
    return key ? t(key) : (type || t('locationTitle'));
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
        {(c.first_name || '')[0] || '?'}{(c.surname || '')[0] || ''}
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
              <span class="field-label">{card.doc_type || card.type || 'ID'}</span>
              <span class="field-value">{card.card_number || card.number || card.value || '—'}</span>
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
              <span class="field-label">{acc.bank_name || acc.bank || acc.name || 'Account'}</span>
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
            <div class="detail-item">
              <span class="field-label">{rel.type_label || rel.type || rel.name || 'Contact'}</span>
              {#if rel.related_contact_id}
                <a class="field-value related-contact" href={`/contacts/${rel.related_contact_id}`}>
                  {rel.related_contact_name || rel.contact_name || rel.name || '—'}
                </a>
              {:else}
                <span class="field-value">{rel.related_contact_name || rel.contact_name || rel.name || '—'}</span>
              {/if}
              <button class="card-action icon-only" aria-label="Editar relación" onclick={() => editSection('relationship')}><Pencil size={16} /></button>
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
          {#each c.organizations as org}
            <div class="detail-item">
              <span class="field-label">{org.organization_name || org.name || 'Organization'}</span>
              <span class="field-value">
                {formatValue(org.achievement || org.role || org.title)}
                {#if formatValue(org.date) !== '—'}
                  <small class="field-helper">{formatValue(org.date)}{#if formatAgeAt(c.birthdate, org.date)} · {formatAgeAt(c.birthdate, org.date)}{/if}</small>
                {/if}
              </span>
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

  @media (max-width: 600px) {
    .detail-header { align-items: flex-start; }
    .detail-header-actions { flex-direction: column; }
    .card-action { min-height: 44px; }
    .detail-item { gap: 8px; }
  }
</style>
