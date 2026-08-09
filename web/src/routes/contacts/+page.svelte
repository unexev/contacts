<script>
  import { A, api, apiRaw } from '$lib/api.svelte.js';
  import { contacts, loading, search } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Search, RefreshCw, ArrowUpDown, Filter, ChevronRight } from '@lucide/svelte';

  let debounceTimer = $state(null);
  let sortBy = $state('name');
  let sortDir = $state('asc');
  let showFilters = $state(false);
  let filterGender = $state('');

  onMount(() => {
    if (!A.token) { goto('/'); return; }
    fetchContacts();
  });

  async function fetchContacts() {
    loading.value = true;
    try {
      let params = ['limit=500'];
      if (search.value) params.push(`search=${encodeURIComponent(search.value)}`);
      if (filterGender) params.push(`gender=${encodeURIComponent(filterGender)}`);
      const query = `?${params.join('&')}`;
      const raw = await apiRaw(`/api/contacts${query}`);
      const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
      contacts.value = sortContacts(list);
    } catch (err) {
      if (err.message === 'unauthorized') goto('/');
      contacts.value = [];
    } finally {
      loading.value = false;
    }
  }

  function sortContacts(list) {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = `${a.first_name || ''} ${a.surname || ''}`.toLowerCase();
        valB = `${b.first_name || ''} ${b.surname || ''}`.toLowerCase();
      } else if (sortBy === 'updated') {
        valA = a.updated_at || 0;
        valB = b.updated_at || 0;
      } else {
        valA = a.first_name || '';
        valB = b.first_name || '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  function toggleSort(field) {
    if (sortBy === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortDir = 'asc';
    }
    contacts.value = sortContacts(contacts.value);
  }

  function onSearchInput(val) {
    search.value = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchContacts, 300);
  }

  function applyFilter() {
    showFilters = false;
    fetchContacts();
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
    <Search class="search-icon" size={18} />
    <input
      class="input"
      type="search"
      placeholder={t('contactsSearch')}
      value={search.value}
      oninput={(e) => onSearchInput(e.target.value)}
    />
  </div>

  <div class="toolbar">
    <div class="toolbar-actions">
      <button class="icon-btn" onclick={() => fetchContacts()} title="Refresh">
        <RefreshCw size={18} />
      </button>
      <button class="icon-btn" class:active={showFilters} onclick={() => showFilters = !showFilters} title="Filter">
        <Filter size={18} />
      </button>
      <button class="icon-btn" onclick={() => toggleSort('name')} title="Sort">
        <ArrowUpDown size={18} />
      </button>
    </div>
  </div>

  {#if showFilters}
    <div class="filter-panel">
      <div class="filter-group">
        <label class="filter-label" for="gender-filter">Gender</label>
        <select id="gender-filter" class="select" bind:value={filterGender}>
          <option value="">All</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick={applyFilter}>Apply</button>
    </div>
  {/if}

  {#if loading.value && contacts.value.length === 0}
    <div class="empty-state">
      <RefreshCw class="empty-state-icon spinning" size={48} />
      <div class="empty-state-text">{t('msgSaving')}</div>
    </div>
  {:else if contacts.value.length === 0}
    <div class="empty-state">
      <Search class="empty-state-icon" size={48} />
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
          <ChevronRight class="list-item-arrow" size={20} />
        </button>
      {/each}
    </div>
  {/if}

  <button class="fab" onclick={() => goto('/contacts/new')}>+</button>
</div>

<style>
  .contacts-page { padding-bottom: 80px; }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .toolbar-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--accent);
    cursor: pointer;
    transition: background 0.15s;
  }

  .icon-btn:hover {
    background: rgba(10, 132, 255, 0.1);
  }

  .icon-btn.active {
    background: rgba(10, 132, 255, 0.2);
  }

  .filter-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
  }

  .filter-group {
    margin-bottom: 12px;
  }

  .filter-label {
    display: block;
    font-size: 13px;
    color: var(--text2);
    margin-bottom: 6px;
  }

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

  :global(.list-item-arrow) {
    color: var(--text2);
    flex-shrink: 0;
  }

  .empty-state-hint {
    font-size: 14px;
    color: var(--text2);
    opacity: 0.7;
  }

  :global(.search-icon) {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text2);
    pointer-events: none;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
