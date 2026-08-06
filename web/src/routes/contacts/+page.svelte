<script>
  import { A, api } from '$lib/api.svelte.js';
  import { contacts, loading, search } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let debounceTimer = $state(null);

  onMount(() => {
    if (!A.token) { goto('/'); return; }
    fetchContacts();
  });

  async function fetchContacts() {
    loading.value = true;
    try {
      const params = search.value ? `?search=${encodeURIComponent(search.value)}` : '';
      const data = await api(`/api/contacts${params}`);
      contacts.value = Array.isArray(data) ? data : (data?.contacts || []);
    } catch (err) {
      if (err.message === 'unauthorized') goto('/');
      contacts.value = [];
    } finally {
      loading.value = false;
    }
  }

  function onSearchInput(val) {
    search.value = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchContacts, 300);
  }

  function getInitials(c) {
    const f = (c.first_name || '')[0] || '';
    const s = (c.surname || '')[0] || '';
    return (f + s).toUpperCase() || '?';
  }

  function formatPhone(p) {
    if (!p) return '';
    return typeof p === 'string' ? p : (p.number || p.value || '');
  }

  function formatEmail(e) {
    if (!e) return '';
    return typeof e === 'string' ? e : (e.address || e.email || e.value || '');
  }
</script>

<div class="contacts-page animate-in">
  <div class="search-bar">
    <span class="icon">&#128269;</span>
    <input
      class="input"
      type="search"
      placeholder={t('contactsSearch')}
      value={search.value}
      oninput={(e) => onSearchInput(e.target.value)}
    />
  </div>

  {#if loading.value && contacts.value.length === 0}
    <div class="empty-state">
      <div class="empty-state-icon">&#8987;</div>
      <div class="empty-state-text">{t('msgSaving')}</div>
    </div>
  {:else if contacts.value.length === 0}
    <div class="empty-state">
      <div class="empty-state-icon">&#128100;</div>
      <div class="empty-state-text">{t('contactsEmpty')}</div>
      <div class="empty-state-hint">{t('contactsEmptyHint')}</div>
    </div>
  {:else}
    <div class="contacts-list">
      {#each contacts.value as contact (contact.contact_id)}
        <button
          class="list-item"
          onclick={() => goto(`/contacts/${contact.contact_id}`)}
        >
          <div class="avatar">{getInitials(contact)}</div>
          <div class="list-item-content">
            <div class="list-item-name">
              {contact.first_name || ''} {contact.surname || ''}
            </div>
            {#if contact.phones?.length}
              <div class="list-item-detail">{formatPhone(contact.phones[0])}</div>
            {/if}
            {#if contact.emails?.length}
              <div class="list-item-detail">{formatEmail(contact.emails[0])}</div>
            {/if}
          </div>
          <div class="list-item-arrow">&#8250;</div>
        </button>
      {/each}
    </div>
  {/if}

  <button class="fab" onclick={() => goto('/contacts/new')}>+</button>
</div>

<style>
  .contacts-page { padding-bottom: 80px; }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .list-item {
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .list-item-content {
    flex: 1;
    min-width: 0;
  }

  .list-item-name {
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-item-detail {
    font-size: 14px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-item-arrow {
    font-size: 20px;
    color: var(--text2);
    flex-shrink: 0;
  }

  .empty-state-hint {
    font-size: 14px;
    color: var(--text2);
    opacity: 0.7;
  }
</style>
