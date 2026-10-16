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
  let loadError = $state(false);

  const sortOptions = [
    { value: 'firstname_az', key: 'sortFirstName' },
    { value: 'surname_az', key: 'sortSurname' },
    { value: 'age_oldest', key: 'sortAgeOldest' },
    { value: 'age_youngest', key: 'sortAgeYoungest' },
    { value: 'recent_newest', key: 'sortRecentNewest' },
    { value: 'recent_oldest', key: 'sortRecentOldest' }
  ];

  onMount(() => {
    if (!A.token) { goto('/login'); return; }
    fetchContacts();
  });

  async function fetchContacts() {
    loading.value = true;
    loadError = false;
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
      if (err.message === 'unauthorized') { goto('/login'); return; }
      loadError = true;
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
    const number = typeof p === 'string' ? p : (p.number || p.value || '');
    let label = '';
    if (typeof p === 'object' && p !== null) {
      if (typeof p.label === 'object' && p.label !== null) {
        label = p.label.Valid ? p.label.String : '';
      } else if (typeof p.label === 'string') {
        label = p.label;
      }
    }
    return label ? `${number} (${label})` : number;
  }

  function formatEmail(e) {
    if (!e) return '';
    const address = typeof e === 'string' ? e : (e.address || e.email || e.value || '');
    let label = '';
    if (typeof e === 'object' && e !== null) {
      if (typeof e.label === 'object' && e.label !== null) {
        label = e.label.Valid ? e.label.String : '';
      } else if (typeof e.label === 'string') {
        label = e.label;
      }
    }
    return label ? `${address} (${label})` : address;
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
      <button class="icon-btn" onclick={() => fetchContacts()} title={t('contactsRefresh')} aria-label={t('contactsRefresh')}>
        <RefreshCw size={18} />
      </button>
      <button class="icon-btn" class:active={showFilters} onclick={() => { showFilters = !showFilters; showSort = false; }} title={t('contactsFilter')} aria-label={t('contactsFilter')}>
        <Filter size={18} />
        {#if activeFilters > 0}
          <span class="filter-badge">{activeFilters}</span>
        {/if}
      </button>
      <button class="icon-btn" class:active={showSort} onclick={() => { showSort = !showSort; showFilters = false; }} title={t('contactsSort')} aria-label={t('contactsSort')}>
        <ArrowUpDown size={18} />
      </button>
    </div>
  </div>

  {#if showFilters}
    <div class="filter-panel">
      <div class="filter-header">
        <span class="filter-title">{t('filtersTitle')}</span>
        <button class="filter-clear" onclick={clearFilters}>{t('filtersClear')}</button>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterGender')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterGender === ''} onclick={() => filterGender = ''}>{t('filterAll')}</button>
           <button class="chip" class:active={filterGender === 'MALE'} onclick={() => filterGender = 'MALE'}>{t('filterMale')}</button>
           <button class="chip" class:active={filterGender === 'FEMALE'} onclick={() => filterGender = 'FEMALE'}>{t('filterFemale')}</button>
           <button class="chip" class:active={filterGender === 'NONE'} onclick={() => filterGender = 'NONE'}>{t('filterNoGender')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterBirthday')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterBirthday === ''} onclick={() => filterBirthday = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterBirthday === 'yes'} onclick={() => filterBirthday = 'yes'}>{t('filterWithBirthday')}</button>
          <button class="chip" class:active={filterBirthday === 'no'} onclick={() => filterBirthday = 'no'}>{t('filterNoBirthday')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterIdCard')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterIDCard === ''} onclick={() => filterIDCard = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterIDCard === 'yes'} onclick={() => filterIDCard = 'yes'}>{t('filterWithIdCard')}</button>
          <button class="chip" class:active={filterIDCard === 'no'} onclick={() => filterIDCard = 'no'}>{t('filterWithoutIdCard')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterOrganization')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterOrganization === ''} onclick={() => filterOrganization = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterOrganization === 'yes'} onclick={() => filterOrganization = 'yes'}>{t('filterWithOrganization')}</button>
          <button class="chip" class:active={filterOrganization === 'no'} onclick={() => filterOrganization = 'no'}>{t('filterWithoutOrganization')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterMaritalStatus')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterMaritalStatus === ''} onclick={() => filterMaritalStatus = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterMaritalStatus === 'yes'} onclick={() => filterMaritalStatus = 'yes'}>{t('filterWithMaritalStatus')}</button>
          <button class="chip" class:active={filterMaritalStatus === 'no'} onclick={() => filterMaritalStatus = 'no'}>{t('filterWithoutMaritalStatus')}</button>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick={applyFilters}>{t('filtersApply')}</button>
    </div>
  {/if}

  {#if showSort}
    <div class="sort-panel">
      <div class="sort-header">
        <span class="sort-title">{t('sortTitle')}</span>
      </div>
      {#each sortOptions as opt}
        <button class="sort-option" class:active={sortBy === opt.value} onclick={() => selectSort(opt.value)}>
          <span>{t(opt.key)}</span>
          {#if sortBy === opt.value}
            <Check size={18} class="sort-check" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if loadError}
    <div class="load-error" role="alert">
      <span>{t('contactsLoadError')}</span>
      <button class="btn btn-secondary" onclick={fetchContacts}>{t('contactsRetry')}</button>
    </div>
  {/if}

  {#if loading.value && contacts.value.length === 0}
    <div class="contacts-list" aria-busy="true" aria-label={t('contactsLoading')} role="status">
      {#each Array(8) as _, i}
        <div class="list-item" aria-hidden="true">
          <span class="skeleton skeleton-circle" style="width:44px;height:44px"></span>
          <div class="list-item-content">
            <span class="skeleton skeleton-line" style="width:{55 + (i * 7) % 30}%;height:16px;margin-bottom:8px"></span>
            <span class="skeleton skeleton-line" style="width:{35 + (i * 11) % 25}%"></span>
          </div>
        </div>
      {/each}
    </div>
  {:else if contacts.value.length === 0 && !loadError}
    <div class="empty-state">
      <Search class="empty-state-icon" size={48} />
      <div class="empty-state-text">{t('contactsEmpty')}</div>
      <div class="empty-state-hint">{t('contactsEmptyHint')}</div>
    </div>
  {:else if contacts.value.length > 0}
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
                 {formatAge(contact.birthdate) || t('contactsAgeUnknown')}
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
    color: var(--accent-text);
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
    color: var(--accent-text);
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
    color: var(--accent-text);
  }

  :global(.sort-check) {
    color: var(--accent-text);
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

  .load-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 12px;
    background: var(--surface);
    border: 1px solid var(--danger);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 15px;
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

</style>
