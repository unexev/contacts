<script>
  import { A, api } from '$lib/api.svelte.js';
  import { currentContact, loading } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ArrowLeft, Pencil, Plus, Trash2, Skull, X, Ellipsis, Camera } from '@lucide/svelte';
  import { formatAge, formatAgeAt, parseContactDate } from '$lib/date.js';
  import { formatValue, formatPhone as formatPhoneBase, formatEmail, formatUrl, formatDate, formatSavedDate } from '$lib/format.js';
  import { resolveDocTypeLabel } from '$lib/docTypes.js';
  import { resolveCountryLabel } from '$lib/countries.js';
  import ContactActionsMenu from '$lib/components/ContactActionsMenu.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import { showToast } from '$lib/toast.svelte.js';
  import ErrorNotice from '$lib/components/ErrorNotice.svelte';
  import { friendlyError } from '$lib/errors.js';

  let showDeleteModal = $state(false);
  let showAddMenu = $state(false);
  let deleting = $state(false);
  let error = $state('');
  let canRetry = $state(false);
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const editLabel = (itemKey) => t('actionEditItem').replace('{item}', t(itemKey));
  const addLabel = (itemKey) => t('actionAddItem').replace('{item}', t(itemKey));

  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
  let photoInput = $state(null);
  let photoBusy = $state(''); // '' | 'upload' | 'remove'
  let photoError = $state('');
  let showPhotoModal = $state(false);
  let photoTrigger = null;

  function photoStatusError(err) {
    if (err.status === 503) return t('photoErrorUnavailable');
    if (err.status === 413) return t('photoErrorSize');
    if (err.status === 400) return t('photoErrorType');
    return friendlyError(err, t);
  }

  async function onPhotoSelected(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (!file) return;
    photoError = '';
    if (!PHOTO_TYPES.includes(file.type)) { photoError = t('photoErrorType'); return; }
    if (file.size > PHOTO_MAX_BYTES) { photoError = t('photoErrorSize'); return; }
    photoBusy = 'upload';
    try {
      const form = new FormData();
      form.append('photo', file);
      const data = await api(`/api/contacts/${contactId}/photo`, { method: 'PUT', body: form });
      if (currentContact.value) currentContact.value = { ...currentContact.value, photo_url: data?.photo_url };
      showToast(t('photoUpdated'));
    } catch (err) {
      if (err.message === 'Invalid credentials') { goto('/login'); return; }
      photoError = photoStatusError(err);
    } finally {
      photoBusy = '';
    }
  }

  function openPhotoRemove(event) {
    photoTrigger = event.currentTarget;
    showPhotoModal = true;
  }

  function closePhotoRemove() {
    showPhotoModal = false;
    photoTrigger?.focus();
  }

  async function removePhoto() {
    showPhotoModal = false;
    photoError = '';
    photoBusy = 'remove';
    try {
      await api(`/api/contacts/${contactId}/photo`, { method: 'DELETE' });
      if (currentContact.value) currentContact.value = { ...currentContact.value, photo_url: undefined };
      showToast(t('photoRemoved'));
    } catch (err) {
      if (err.message === 'Invalid credentials') { goto('/login'); return; }
      photoError = photoStatusError(err);
    } finally {
      photoBusy = '';
    }
  }

  let addToggle = $state(null);

  function onWindowKeydown(event) {
    if (event.key === 'Escape' && showAddMenu && !showDeleteModal && !showPhotoModal) {
      showAddMenu = false;
      addToggle?.focus();
    }
  }

  let phoneMenu = $state(null); // { number, active, trigger }

  // Delete confirmation dialog: focus moves in, stays trapped, and returns on close.
  let deleteTrigger = null;
  let dialogEl = $state(null);

  function openDelete(event) {
    deleteTrigger = event.currentTarget;
    showDeleteModal = true;
  }

  function closeDelete() {
    showDeleteModal = false;
    deleteTrigger?.focus();
  }

  $effect(() => {
    // Start on the safe choice (Cancel) so Enter never deletes by accident.
    if ((showDeleteModal || showPhotoModal) && dialogEl) dialogEl.querySelector('[data-autofocus]')?.focus();
  });

  function onDialogKeydown(event) {
    if (event.key === 'Escape') { event.stopPropagation(); if (showPhotoModal) closePhotoRemove(); else closeDelete(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogEl.querySelectorAll('button:not([disabled])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function togglePhoneMenu(event, number, active) {
    phoneMenu = phoneMenu?.trigger === event.currentTarget ? null : { number, active, trigger: event.currentTarget };
  }

  function closePhoneMenu(restoreFocus = true) {
    const trigger = phoneMenu?.trigger;
    phoneMenu = null;
    if (restoreFocus) trigger?.focus();
  }

  let contactId = $derived($page.params.id);

  onMount(() => {
    if (!A.token) { goto('/login'); return; }
    fetchContact();
  });

  async function fetchContact() {
    loading.value = true;
    error = '';
    canRetry = false;
    // Never show the previous contact's data under an error for this one.
    currentContact.value = null;
    try {
      const data = await api(`/api/contacts/${contactId}`);
      currentContact.value = data;
    } catch (err) {
      if (err.message === 'Invalid credentials') { goto('/login'); return; }
      error = friendlyError(err, t);
      canRetry = true;
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
      error = friendlyError(err, t);
      canRetry = false;
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
    return p.phone || p.number || p.value || '—';
  }

  // The label ("Casa", "Trabajo") goes in the helper line, not in parentheses after the number.
  function phoneLabel(p) {
    if (!p || typeof p === 'string') return '';
    if (typeof p.label === 'object' && p.label !== null) return p.label.Valid ? p.label.String : '';
    return typeof p.label === 'string' ? p.label : '';
  }

  function phoneMeta(p) {
    return [
      phoneLabel(p),
      p.is_active ? t('phoneInUse') : t('phoneNotInUse'),
      p.created_at ? `${t('phoneSavedOn')} ${formatSavedDate(p.created_at)}` : ''
    ].filter(Boolean).join(' · ');
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

<svelte:window onkeydown={onWindowKeydown} />

<div class="detail-page animate-in">
  <div class="detail-header">
    <button class="btn-ghost" onclick={() => goto('/contacts')}>
      <ArrowLeft size={18} /> {t('contactBack')}
    </button>
    <div class="detail-header-actions">
      <button class="btn-ghost danger" onclick={openDelete}>
        <Trash2 size={18} /> {t('contactDelete')}
      </button>
    </div>
  </div>

  {#if phoneMenu}
    <ContactActionsMenu phone={phoneMenu.number} canCall={phoneMenu.active} anchor={phoneMenu.trigger} onclose={closePhoneMenu} />
  {/if}

  {#if error}
    <ErrorNotice message={error} onretry={canRetry ? fetchContact : undefined} />
  {/if}

  {#if loading.value}
    <div aria-busy="true" role="status" aria-label={t('contactLoading')}>
      <div class="detail-avatar-section">
        <span class="skeleton skeleton-circle" style="width:80px;height:80px;margin-bottom:12px"></span>
        <span class="skeleton" style="width:180px;height:24px"></span>
      </div>
      {#each Array(3) as _}
        <div class="section-card">
          <div class="section-card-body">
            <span class="skeleton skeleton-line" style="width:40%;margin-bottom:14px"></span>
            <span class="skeleton skeleton-line" style="width:75%;margin-bottom:10px"></span>
            <span class="skeleton skeleton-line" style="width:60%"></span>
          </div>
        </div>
      {/each}
    </div>
  {:else if currentContact.value}
    {@const c = currentContact.value}

    <div class="detail-avatar-section">
      {#if c.deceased && !c.photo_url}
        <div class="detail-avatar">
          <Skull size={38} strokeWidth={1.8} aria-label={t('contactDeceased')} />
        </div>
      {:else}
        <div class="detail-avatar-wrap"><Avatar contact={c} size={80} bordered /></div>
      {/if}
      <input
        bind:this={photoInput}
        class="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabindex="-1"
        aria-hidden="true"
        onchange={onPhotoSelected}
      />
      <div class="photo-actions">
        <button class="card-action" onclick={() => photoInput?.click()} disabled={!!photoBusy}>
          <Camera size={16} /> {photoBusy === 'upload' ? t('photoUploading') : c.photo_url ? t('photoChange') : t('photoAdd')}
        </button>
        {#if c.photo_url}
          <button class="card-action" onclick={openPhotoRemove} disabled={!!photoBusy}>
            <Trash2 size={16} /> {photoBusy === 'remove' ? t('photoRemoving') : t('photoRemove')}
          </button>
        {/if}
      </div>
      {#if photoError}
        <div class="photo-error"><ErrorNotice message={photoError} /></div>
      {/if}
       <h1 class="detail-name">
         {c.first_name || ''} {c.middle_name || ''} {c.surname || ''}
       </h1>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <h2 class="section-card-title">{t('contactPersonal')}</h2>
        <button class="card-action" aria-label={editLabel('itemPersonal')} onclick={() => editSection('personal')}><Pencil size={16} /> {t('actionEdit')}</button>
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
          <h2 class="section-card-title">{t('contactPhones')}</h2>
          <button class="card-action" aria-label={addLabel('itemPhone')} onclick={() => editSection('phone', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.phones as phone}
            <div class="detail-item">
              <div><span class:inactive-phone={!phone.is_active} class="field-value">{formatPhone(phone)}</span><small class="field-helper">{phoneMeta(phone)}</small></div>
              <div class="item-actions">
                {#if phone.phone}
                  <button
                    class="card-action icon-only"
                    aria-haspopup="menu"
                    aria-expanded={phoneMenu?.number === phone.phone}
                    aria-label={`${t('contactMore')}: ${phone.phone}`}
                    onclick={(e) => togglePhoneMenu(e, phone.phone, phone.is_active)}
                  ><Ellipsis size={16} /></button>
                {/if}
                <button class="card-action icon-only" aria-label={`${editLabel('itemPhone')}: ${phone.phone}`} onclick={() => editSection('phone')}><Pencil size={16} /></button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.emails?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactEmails')}</h2>
          <button class="card-action" aria-label={addLabel('itemEmail')} onclick={() => editSection('email', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.emails as email}
            <div class="detail-item">
              <span class="field-value">{formatEmail(email)}</span>
              <button class="card-action icon-only" aria-label={editLabel('itemEmail')} onclick={() => editSection('email')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.urls?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactUrls')}</h2>
          <button class="card-action" aria-label={addLabel('itemUrl')} onclick={() => editSection('url', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.urls as url}
            <div class="detail-item">
              <span class="field-value">{formatUrl(url)}</span>
              <button class="card-action icon-only" aria-label={editLabel('itemUrl')} onclick={() => editSection('url')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.notes?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactNotes')}</h2>
          <button class="card-action" aria-label={addLabel('itemNote')} onclick={() => editSection('note', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.notes as note}
            <div class="detail-item"><div class="notes-text">{note.note || note.text || formatValue(note)}</div><button class="card-action icon-only" aria-label={editLabel('itemNote')} onclick={() => editSection('note')}><Pencil size={16} /></button></div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.keywords?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactKeywords')}</h2>
          <button class="card-action" aria-label={addLabel('itemKeyword')} onclick={() => editSection('keyword', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          <div class="keywords-list">
            {#each c.keywords as kw}
              <span class="keyword-item"><span class="keyword-tag">{kw}</span><button class="card-action icon-only" aria-label={editLabel('itemKeyword')} onclick={() => editSection('keyword')}><Pencil size={16} /></button></span>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if c.identity_cards?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactIdentity')}</h2>
          <button class="card-action" aria-label={addLabel('itemCard')} onclick={() => editSection('card', true)}><Plus size={16} /> {t('actionAdd')}</button>
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
              <button class="card-action icon-only" aria-label={editLabel('itemCard')} onclick={() => editSection('card')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.bank_accounts?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactBank')}</h2>
          <button class="card-action" aria-label={addLabel('itemBank')} onclick={() => editSection('bank', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.bank_accounts as acc}
            <div class="detail-item">
              <span class="field-label">{formatValue(acc.bank_name) !== '—' ? formatValue(acc.bank_name) : (acc.bank || acc.name || 'Account')}</span>
              <span class="field-value">{acc.account_number || acc.number || acc.iban || acc.value || '—'}</span>
              <button class="card-action icon-only" aria-label={editLabel('itemBank')} onclick={() => editSection('bank')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.relationships?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactRelationships')}</h2>
          <button class="card-action" aria-label={addLabel('itemRelationship')} onclick={() => editSection('relationship', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.relationships as rel}
            <div class="detail-item relation-item">
              <div>
                <span class="field-label">{rel.type_label || rel.type_id || '—'}</span>
                {#if rel.related_contact_id}
                  <a class="field-value related-contact" href={`/contacts/${rel.related_contact_id}`}>
                    {rel.related_contact_name || rel.contact_name || rel.name || rel.related_contact_id}
                  </a>
                {:else}
                  <span class="field-value">{rel.related_contact_name || rel.contact_name || rel.name || '—'}</span>
                {/if}
              </div>
              <div class="item-actions">
                <span class="related-arrow" aria-hidden="true">›</span>
                <button class="card-action icon-only" aria-label={editLabel('itemRelationship')} onclick={() => editSection('relationship')}><Pencil size={16} /></button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.organizations?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('contactOrganizations')}</h2>
          <button class="card-action" aria-label={addLabel('itemOrganization')} onclick={() => editSection('organization', true)}><Plus size={16} /> {t('actionAdd')}</button>
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
              <button class="card-action icon-only" aria-label={editLabel('itemOrganization')} onclick={() => editSection('organization')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.locations?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('locationTitle')}</h2>
          <button class="card-action" aria-label={addLabel('itemLocation')} onclick={() => editSection('location', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.locations as location}
            <div class="detail-item">
              <div><span class="field-label">{locationType(location.location_type)}</span><span class="field-value location-value">{[location.address, location.city, location.region, location.country, location.postal_code].filter(Boolean).join(', ') || '—'}</span>{#if location.latitude !== null && location.longitude !== null}<small class="field-helper">{location.latitude}, {location.longitude}</small>{/if}</div>
              <button class="card-action icon-only" aria-label={editLabel('itemLocation')} onclick={() => editSection('location')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.nationalities?.length}
      <div class="section-card">
        <div class="section-card-header">
          <h2 class="section-card-title">{t('nationalityTitle')}</h2>
          <button class="card-action" aria-label={addLabel('itemNationality')} onclick={() => editSection('nationality', true)}><Plus size={16} /> {t('actionAdd')}</button>
        </div>
        <div class="section-card-body">
          {#each c.nationalities as nat}
            <div class="detail-item">
              <div>
                <span class="field-label">{resolveCountryLabel(nat.country_code, t)}</span>
                {#if formatValue(nat.note) !== '—'}<span class="field-value location-value">{formatValue(nat.note)}</span>{/if}
                {#if formatValue(nat.acquired_at) !== '—'}<small class="field-helper">{formatDate(nat.acquired_at)}</small>{/if}
              </div>
              <button class="card-action icon-only" aria-label={editLabel('itemNationality')} onclick={() => editSection('nationality')}><Pencil size={16} /></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

      <!-- Agregar datos - botón único al final, desplegable mobile-friendly -->
      <div class="add-data-footer">
        <button class="{showAddMenu ? 'btn btn-secondary' : 'btn btn-primary'} add-main-btn" class:is-open={showAddMenu} onclick={() => showAddMenu = !showAddMenu} aria-expanded={showAddMenu} aria-controls="add-menu" bind:this={addToggle}>
          {#if showAddMenu}<X size={18} /> {t('actionClose')}{:else}<Plus size={18} /> {t('actionAdd')}{/if}
        </button>
        {#if showAddMenu}
          <div class="add-menu" id="add-menu">
            {#each [['phone', 'itemPhone'], ['email', 'itemEmail'], ['card', 'itemCard'], ['organization', 'itemOrganization'], ['location', 'itemLocation'], ['nationality', 'itemNationality'], ['url', 'itemUrl'], ['note', 'itemNote'], ['keyword', 'itemKeyword'], ['bank', 'itemBank'], ['relationship', 'itemRelationship']] as item}
              <button class="add-menu-item" onclick={() => { showAddMenu = false; editSection(item[0], true); }}>
                <Plus size={14} /> {cap(t(item[1]))}
              </button>
            {/each}
          </div>
        {/if}
      </div>
  {/if}
</div>

{#if showDeleteModal}
  <div class="modal-overlay" role="presentation" onclick={closeDelete}>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-text"
      tabindex="-1"
      bind:this={dialogEl}
      onclick={(e) => e.stopPropagation()}
      onkeydown={onDialogKeydown}
    >
      <div class="modal-title" id="delete-title">{t('contactDelete')}</div>
      <div class="modal-text" id="delete-text">{t('contactDeleteHint')}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-autofocus onclick={closeDelete}>
          {t('contactCancel')}
        </button>
        <button class="btn btn-danger" onclick={deleteContact} disabled={deleting}>
          {deleting ? '...' : t('contactDelete')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showPhotoModal}
  <div class="modal-overlay" role="presentation" onclick={closePhotoRemove}>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-title"
      aria-describedby="photo-text"
      tabindex="-1"
      bind:this={dialogEl}
      onclick={(e) => e.stopPropagation()}
      onkeydown={onDialogKeydown}
    >
      <div class="modal-title" id="photo-title">{t('photoRemoveTitle')}</div>
      <div class="modal-text" id="photo-text">{t('photoRemoveHint')}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-autofocus onclick={closePhotoRemove}>
          {t('contactCancel')}
        </button>
        <button class="btn btn-danger" onclick={removePhoto}>
          {t('photoRemove')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .detail-avatar-wrap { margin-bottom: 12px; }
  .photo-input { display: none; }
  .photo-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 12px; }
  .photo-error { width: 100%; }
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

  .item-actions {
    display: flex;
    flex-shrink: 0;
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
    color: var(--accent-text);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .card-action:hover { background: var(--surface); border-color: var(--accent); }
  .card-action.icon-only { width: 44px; padding: 8px; }

  .detail-item {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
  }

  .detail-item + .detail-item { border-top: 1px solid var(--border); }

  .location-value { display: block; text-align: left; margin-top: 3px; }
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
  .keyword-item .card-action { min-height: 44px; width: 44px; padding: 5px; margin: -6px -4px -6px 0; border: 0; background: transparent; }

  .btn-ghost.danger {
    color: var(--danger-text);
  }

  .detail-avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 28px;
  }

  .detail-avatar {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--accent-text);
    margin-bottom: 12px;
  }

  .detail-name {
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    letter-spacing: -0.3px;
  }

  .deceased-status { color: var(--danger-text); }
  .add-data-footer { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  .add-main-btn { width: 100%; justify-content: center; min-height: 48px; font-size: 0.9375rem; gap: 8px; transition: all 0.2s ease; }
  .add-main-btn.is-open { background: var(--surface2) !important; border-color: var(--border) !important; color: var(--text2) !important; }
  .add-main-btn.is-open:hover { background: var(--surface) !important; color: var(--text) !important; border-color: var(--text2) !important; }
  .add-menu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; animation: fadeIn 0.15s ease; }
  .add-menu-item { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface2); color: var(--text); font-size: 0.875rem; font-weight: 500; cursor: pointer; justify-content: flex-start; }
  .add-menu-item:hover { background: var(--surface); border-color: var(--accent); color: var(--accent-text); }
  .organization-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .organization-copy strong { font-size: 0.9375rem; color: var(--text); }
  .relation-item { position: relative; cursor: pointer; border-radius: 10px; transition: background 0.15s ease; }
  .relation-item:hover { background: var(--surface2); }
  /* Stretched link: the whole row opens the related contact without nesting controls. */
  .related-contact::after { content: ''; position: absolute; inset: 0; border-radius: 10px; }
  .relation-item .item-actions { position: relative; z-index: 1; }
  .related-arrow { color: var(--text2); font-size: 1.25rem; line-height: 1; padding: 0 4px; }

  .notes-text {
    font-size: 0.9375rem;
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
    font-size: 0.8125rem;
    color: var(--accent-text);
    border: 1px solid var(--border);
  }

  .field-helper { display: block; color: var(--text2); font-size: 0.75rem; margin-top: 2px; }
  .related-contact { color: var(--accent-text); text-decoration: none; }
  .related-contact:hover { text-decoration: underline; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .add-menu { animation: none; }
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
