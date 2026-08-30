<script>
  import { A, api, apiRaw } from '$lib/api.svelte.js';
  import { contacts, loading, search } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Search, RefreshCw, ArrowUpDown, Filter, ChevronRight, X, Check } from '@lucide/svelte';
  import { calculateAge, formatAge, parseContactDate } from '$lib/date.js';

  let debounceTimer = $state(null);
  let showFilters = $state(false);
  let showSort = $state(false);

  let filterGender = $state('');
  let filterBirthday = $state('');
  let filterIDCard = $state('');
  let filterOrganization = $state('');
  let filterMaritalStatus = $state('');

  let sortBy = $state('firstname_az');

  const sortOptions = [
    { value: 'firstname_az', label: 'First name (A-Z)' },
    { value: 'surname_az', label: 'Surname (A-Z)' },
    { value: 'age_oldest', label: 'Age (oldest to youngest)' },
    { value: 'age_youngest', label: 'Age (youngest to oldest)' },
    { value: 'recent_newest', label: 'Recently added (newest first)' },
    { value: 'recent_oldest', label: 'Recently added (oldest first)' }
  ];

  onMount(() => {
    if (!A.token) { goto('/'); return; }
    fetchContacts();
  });

  async function fetchContacts() {
    loading.value = true;
    try {
       let params = ['limit=100'];
      if (search.value) params.push(`search=${encodeURIComponent(search.value)}`);
      if (filterGender) params.push(`gender=${encodeURIComponent(filterGender)}`);
      if (filterBirthday === 'yes') params.push('has_birthday=true');
      if (filterBirthday === 'no') params.push('has_birthday=false');
      if (filterIDCard === 'yes') params.push('has_id_card=true');
      if (filterIDCard === 'no') params.push('has_id_card=false');
      if (filterOrganization === 'yes') params.push('has_organization=true');
      if (filterOrganization === 'no') params.push('has_organization=false');
      if (filterMaritalStatus === 'yes') params.push('has_marital_status=true');
      if (filterMaritalStatus === 'no') params.push('has_marital_status=false');
       let offset = 0;
       let total = Infinity;
       const list = [];
       while (offset < total) {
         const query = `?${params.join('&')}&offset=${offset}`;
         const raw = await apiRaw(`/api/contacts${query}`);
         const page = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
         list.push(...page);
         total = Number.isFinite(raw?.total) ? raw.total : list.length;
         if (page.length === 0) break;
         offset += page.length;
       }
       contacts.value = sortContacts(list);
    } catch (err) {
      if (err.message === 'unauthorized') goto('/');
      contacts.value = [];
    } finally {
      loading.value = false;
    }
  }

  function getAge(birthdate) {
    if (!birthdate) return 0;
    return calculateAge(birthdate) ?? 0;
  }

  function sortContacts(list) {
    const sorted = [...list];
    sorted.sort((a, b) => {
      const birthA = parseContactDate(a.birthdate);
      const birthB = parseContactDate(b.birthdate);
      switch (sortBy) {
        case 'firstname_az':
          return (a.first_name || '').localeCompare(b.first_name || '');
        case 'surname_az':
          return (a.surname || '').localeCompare(b.surname || '');
        case 'age_oldest':
          if (!birthA && birthB) return 1;
          if (birthA && !birthB) return -1;
          if (!birthA || !birthB) return 0;
          return birthA.getTime() - birthB.getTime();
        case 'age_youngest':
          if (!birthA && birthB) return 1;
          if (birthA && !birthB) return -1;
          if (!birthA || !birthB) return 0;
          return birthB.getTime() - birthA.getTime();
        case 'recent_newest':
          return (b.updated_at || 0) - (a.updated_at || 0);
        case 'recent_oldest':
          return (a.updated_at || 0) - (b.updated_at || 0);
        default:
          return 0;
      }
    });
    return sorted;
  }

  function onSearchInput(val) {
    search.value = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchContacts, 300);
  }

  function applyFilters() {
    showFilters = false;
    fetchContacts();
  }

  function clearFilters() {
    filterGender = '';
    filterBirthday = '';
    filterIDCard = '';
    filterOrganization = '';
    filterMaritalStatus = '';
    fetchContacts();
  }

  function selectSort(val) {
    sortBy = val;
    showSort = false;
    contacts.value = sortContacts(contacts.value);
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

  let activeFilters = $derived(
    (filterGender ? 1 : 0) +
    (filterBirthday ? 1 : 0) +
    (filterIDCard ? 1 : 0) +
    (filterOrganization ? 1 : 0) +
    (filterMaritalStatus ? 1 : 0)
  );
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
      <button class="icon-btn" class:active={showFilters} onclick={() => { showFilters = !showFilters; showSort = false; }} title="Filter">
        <Filter size={18} />
        {#if activeFilters > 0}
          <span class="filter-badge">{activeFilters}</span>
        {/if}
      </button>
      <button class="icon-btn" class:active={showSort} onclick={() => { showSort = !showSort; showFilters = false; }} title="Sort">
        <ArrowUpDown size={18} />
      </button>
    </div>
  </div>

  {#if showFilters}
    <div class="filter-panel">
      <div class="filter-header">
        <span class="filter-title">Filters</span>
        <button class="filter-clear" onclick={clearFilters}>Clear all</button>
      </div>

      <div class="filter-section">
        <span class="filter-label">Gender</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterGender === ''} onclick={() => filterGender = ''}>All</button>
           <button class="chip" class:active={filterGender === 'MALE'} onclick={() => filterGender = 'MALE'}>Male</button>
           <button class="chip" class:active={filterGender === 'FEMALE'} onclick={() => filterGender = 'FEMALE'}>Female</button>
           <button class="chip" class:active={filterGender === 'NONE'} onclick={() => filterGender = 'NONE'}>No gender</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">Birthday</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterBirthday === ''} onclick={() => filterBirthday = ''}>All</button>
          <button class="chip" class:active={filterBirthday === 'yes'} onclick={() => filterBirthday = 'yes'}>With birthday</button>
          <button class="chip" class:active={filterBirthday === 'no'} onclick={() => filterBirthday = 'no'}>No birthday</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">ID card</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterIDCard === ''} onclick={() => filterIDCard = ''}>All</button>
          <button class="chip" class:active={filterIDCard === 'yes'} onclick={() => filterIDCard = 'yes'}>With ID card</button>
          <button class="chip" class:active={filterIDCard === 'no'} onclick={() => filterIDCard = 'no'}>Without ID card</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">Organization</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterOrganization === ''} onclick={() => filterOrganization = ''}>All</button>
          <button class="chip" class:active={filterOrganization === 'yes'} onclick={() => filterOrganization = 'yes'}>With organization</button>
          <button class="chip" class:active={filterOrganization === 'no'} onclick={() => filterOrganization = 'no'}>Without organization</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">Marital status</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterMaritalStatus === ''} onclick={() => filterMaritalStatus = ''}>All</button>
          <button class="chip" class:active={filterMaritalStatus === 'yes'} onclick={() => filterMaritalStatus = 'yes'}>With marital status</button>
          <button class="chip" class:active={filterMaritalStatus === 'no'} onclick={() => filterMaritalStatus = 'no'}>Without marital status</button>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick={applyFilters}>Apply filters</button>
    </div>
  {/if}

  {#if showSort}
    <div class="sort-panel">
      <div class="sort-header">
        <span class="sort-title">Sort by</span>
      </div>
      {#each sortOptions as opt}
        <button class="sort-option" class:active={sortBy === opt.value} onclick={() => selectSort(opt.value)}>
          <span>{opt.label}</span>
          {#if sortBy === opt.value}
            <Check size={18} class="sort-check" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading.value && contacts.value.length === 0}
    <div class="empty-state">
      <RefreshCw class="spinning" size={48} />
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
                {contact.first_name || ''} {contact.middle_name || ''} {contact.surname || ''}
              </div>
              {#if contact.deceased}
                <div class="list-item-status deceased-status">{t('contactDeceased')}</div>
              {/if}
             {#if sortBy === 'age_oldest' || sortBy === 'age_youngest'}
               <div class="list-item-detail">
                 {formatAge(contact.birthdate) || 'Edad no registrada'}
               </div>
             {/if}
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
    position: relative;
  }

  .icon-btn:hover {
    background: rgba(10, 132, 255, 0.1);
  }

  .icon-btn.active {
    background: rgba(10, 132, 255, 0.2);
  }

  .filter-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .filter-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
  }

  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .filter-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .filter-clear {
    font-size: 13px;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
  }

  .filter-section {
    margin-bottom: 16px;
  }

  .filter-label {
    display: block;
    font-size: 13px;
    color: var(--text2);
    margin-bottom: 8px;
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .chip:hover {
    border-color: var(--text2);
  }

  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .sort-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 12px;
  }

  .sort-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }

  .sort-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .sort-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-size: 15px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s;
  }

  .sort-option:last-child {
    border-bottom: none;
  }

  .sort-option:hover {
    background: var(--surface2);
  }

  .sort-option.active {
    color: var(--accent);
  }

  :global(.sort-check) {
    color: var(--accent);
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

   .list-item-status { font-size: 12px; color: var(--text2); }
   .deceased-status { color: var(--danger); }

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
