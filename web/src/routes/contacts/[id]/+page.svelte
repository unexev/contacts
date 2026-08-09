<script>
  import { A, api } from '$lib/api.svelte.js';
  import { currentContact, loading } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ArrowLeft, Pencil, Trash2, RefreshCw, User } from '@lucide/svelte';

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
    return p.number || p.value || '—';
  }

  function formatEmail(e) {
    if (typeof e === 'string') return e;
    return e.address || e.email || e.value || '—';
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
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '—';
    }
  }
</script>

<div class="detail-page animate-in">
  <div class="detail-header">
    <button class="btn-ghost" onclick={() => goto('/contacts')}>
      <ArrowLeft size={18} /> {t('contactBack')}
    </button>
    <div class="detail-header-actions">
      <button class="btn-ghost" onclick={() => goto(`/contacts/${contactId}/edit`)}>
        <Pencil size={18} /> {t('contactEdit')}
      </button>
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
          <span class="field-value">{formatDate(c.birthdate)}</span>
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
        </div>
        <div class="section-card-body">
          {#each c.phones as phone}
            <div class="field-row">
              <span class="field-value">{formatPhone(phone)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.emails?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactEmails')}</span>
        </div>
        <div class="section-card-body">
          {#each c.emails as email}
            <div class="field-row">
              <span class="field-value">{formatEmail(email)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.urls?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactUrls')}</span>
        </div>
        <div class="section-card-body">
          {#each c.urls as url}
            <div class="field-row">
              <span class="field-value">{formatUrl(url)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.notes}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactNotes')}</span>
        </div>
        <div class="section-card-body">
          <div class="notes-text">{c.notes}</div>
        </div>
      </div>
    {/if}

    {#if c.keywords?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactKeywords')}</span>
        </div>
        <div class="section-card-body">
          <div class="keywords-list">
            {#each c.keywords as kw}
              <span class="keyword-tag">{kw}</span>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if c.identity_cards?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactIdentity')}</span>
        </div>
        <div class="section-card-body">
          {#each c.identity_cards as card}
            <div class="field-row">
              <span class="field-label">{card.type || 'ID'}</span>
              <span class="field-value">{card.number || card.value || '—'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.bank_accounts?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactBank')}</span>
        </div>
        <div class="section-card-body">
          {#each c.bank_accounts as acc}
            <div class="field-row">
              <span class="field-label">{acc.bank || acc.name || 'Account'}</span>
              <span class="field-value">{acc.number || acc.iban || acc.value || '—'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.relationships?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactRelationships')}</span>
        </div>
        <div class="section-card-body">
          {#each c.relationships as rel}
            <div class="field-row">
              <span class="field-label">{rel.type || rel.name || 'Contact'}</span>
              <span class="field-value">{rel.contact_name || rel.name || '—'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if c.organizations?.length}
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">{t('contactOrganizations')}</span>
        </div>
        <div class="section-card-body">
          {#each c.organizations as org}
            <div class="field-row">
              <span class="field-label">{org.name || 'Organization'}</span>
              <span class="field-value">{org.role || org.title || '—'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
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

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
