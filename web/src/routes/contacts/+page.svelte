<script>
  import { A, api, apiRaw } from '$lib/api.svelte.js';
  import { contacts, loading, search } from '$lib/stores.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Search, RefreshCw, ArrowUpDown, Filter, X, Check, Ellipsis } from '@lucide/svelte';
  import { hasActions, primaryPhone, primaryEmail } from '$lib/contactActions.js';
  import ContactActionsMenu from '$lib/components/ContactActionsMenu.svelte';
  import ErrorNotice from '$lib/components/ErrorNotice.svelte';
  import { loadView, saveView } from '$lib/viewState.js';
  import { calculateAge, formatAge, parseContactDate } from '$lib/date.js';

  let debounceTimer = $state(null);
  let showFilters = $state(false);
  let showSort = $state(false);

  // Restore the last applied sort and filters (search is intentionally not saved).
  const saved = loadView();

  let filterGender = $state(saved.filterGender);
  let filterBirthday = $state(saved.filterBirthday);
  let filterIDCard = $state(saved.filterIDCard);
  let filterOrganization = $state(saved.filterOrganization);
  let filterMaritalStatus = $state(saved.filterMaritalStatus);

  let sortBy = $state(saved.sortBy);

  function persistView() {
    saveView({ sortBy, filterGender, filterBirthday, filterIDCard, filterOrganization, filterMaritalStatus });
  }
  let loadError = $state(false);
  let syncing = $state(false);
  let searchHeight = $state(66);

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

  let fetchId = 0;

  async function fetchContacts() {
    const myId = ++fetchId;
    loading.value = true;
    syncing = true;
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
         if (myId !== fetchId) return;
         const page = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
         list.push(...page);
         total = Number.isFinite(raw?.total) ? raw.total : list.length;
         // Show the first page right away; later pages append in the background.
         contacts.value = sortContacts(list);
         if (offset === 0) loading.value = false;
         if (page.length === 0) break;
         offset += page.length;
       }
    } catch (err) {
      if (myId !== fetchId) return;
      if (err.message === 'unauthorized') { goto('/login'); return; }
      loadError = true;
    } finally {
      if (myId === fetchId) {
        loading.value = false;
        syncing = false;
      }
    }
  }

  let showLetters = $derived(sortBy === 'firstname_az' || sortBy === 'surname_az');

  function letterOf(c) {
    const source = sortBy === 'surname_az' ? (c.surname || c.first_name) : (c.first_name || c.surname);
    const ch = String(source || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()[0]?.toUpperCase() || '';
    return /[A-Z]/.test(ch) ? ch : '#';
  }

  // Flat rows, with a letter header whenever the sort letter changes.
  let rows = $derived.by(() => {
    if (!showLetters) return contacts.value.map((contact) => ({ contact, key: contact.contact_id }));
    const out = [];
    let last = '';
    for (const contact of contacts.value) {
      const letter = letterOf(contact);
      if (letter !== last) {
        out.push({ letter, key: `letter-${out.length}` });
        last = letter;
      }
      out.push({ contact, key: contact.contact_id });
    }
    return out;
  });

  // The first letter shares a line with the action buttons instead of owning a header row.
  let firstLetter = $derived(rows[0]?.letter ?? '');
  let listRows = $derived(firstLetter ? rows.slice(1) : rows);

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
    persistView();
    fetchContacts();
  }

  function clearFilters() {
    filterGender = '';
    filterBirthday = '';
    filterIDCard = '';
    filterOrganization = '';
    filterMaritalStatus = '';
    persistView();
    fetchContacts();
  }

  function selectSort(val) {
    sortBy = val;
    showSort = false;
    persistView();
    contacts.value = sortContacts(contacts.value);
  }


  // ── Quick actions menu (see ContactActionsMenu) ──
  let menu = $state(null); // { contact, trigger }

  function contactName(c) {
    return [c.first_name, c.middle_name, c.surname].filter(Boolean).join(' ');
  }

  function openMenu(event, contact) {
    if (menu?.contact.contact_id === contact.contact_id) { closeMenu(true); return; }
    menu = { contact, trigger: event.currentTarget };
  }

  function closeMenu(restoreFocus = true) {
    const trigger = menu?.trigger;
    menu = null;
    if (restoreFocus) trigger?.focus();
  }

  function getInitials(c) {
    const f = (c.first_name || '')[0] || '';
    const s = (c.surname || '')[0] || '';
    return (f + s).toUpperCase() || '?';
  }

  function formatPhone(p) {
    if (!p) return '';
    return typeof p === 'string' ? p : (p.phone || p.number || p.value || '');
  }

  function formatEmail(e) {
    if (!e) return '';
    return typeof e === 'string' ? e : (e.email || e.address || e.value || '');
  }

  let activeFilters = $derived(
    (filterGender ? 1 : 0) +
    (filterBirthday ? 1 : 0) +
    (filterIDCard ? 1 : 0) +
    (filterOrganization ? 1 : 0) +
    (filterMaritalStatus ? 1 : 0)
  );
</script>

<div class="contacts-page animate-in" style="--search-h: {searchHeight}px">
  <div class="search-bar" bind:clientHeight={searchHeight}>
    <Search class="search-icon" size={18} />
    <input
      class="input"
      type="search"
      placeholder={t('contactsSearch')}
      value={search.value}
      oninput={(e) => onSearchInput(e.target.value)}
    />
  </div>

  <div class="list-toolbar">
    {#if firstLetter}<h2 class="letter-head-inline">{firstLetter}</h2>{/if}
    <div class="toolbar-actions">
      <button class="icon-btn" onclick={() => fetchContacts()} title={t('contactsRefresh')} aria-label={t('contactsRefresh')} aria-busy={syncing} disabled={syncing}>
        <RefreshCw class={syncing ? 'spin-icon' : ''} size={18} />
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
          <button class="chip" class:active={filterGender === ''} aria-pressed={filterGender === ''} onclick={() => filterGender = ''}>{t('filterAll')}</button>
           <button class="chip" class:active={filterGender === 'MALE'} aria-pressed={filterGender === 'MALE'} onclick={() => filterGender = 'MALE'}>{t('filterMale')}</button>
           <button class="chip" class:active={filterGender === 'FEMALE'} aria-pressed={filterGender === 'FEMALE'} onclick={() => filterGender = 'FEMALE'}>{t('filterFemale')}</button>
           <button class="chip" class:active={filterGender === 'NONE'} aria-pressed={filterGender === 'NONE'} onclick={() => filterGender = 'NONE'}>{t('filterNoGender')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterBirthday')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterBirthday === ''} aria-pressed={filterBirthday === ''} onclick={() => filterBirthday = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterBirthday === 'yes'} aria-pressed={filterBirthday === 'yes'} onclick={() => filterBirthday = 'yes'}>{t('filterWithBirthday')}</button>
          <button class="chip" class:active={filterBirthday === 'no'} aria-pressed={filterBirthday === 'no'} onclick={() => filterBirthday = 'no'}>{t('filterNoBirthday')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterIdCard')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterIDCard === ''} aria-pressed={filterIDCard === ''} onclick={() => filterIDCard = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterIDCard === 'yes'} aria-pressed={filterIDCard === 'yes'} onclick={() => filterIDCard = 'yes'}>{t('filterWithIdCard')}</button>
          <button class="chip" class:active={filterIDCard === 'no'} aria-pressed={filterIDCard === 'no'} onclick={() => filterIDCard = 'no'}>{t('filterWithoutIdCard')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterOrganization')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterOrganization === ''} aria-pressed={filterOrganization === ''} onclick={() => filterOrganization = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterOrganization === 'yes'} aria-pressed={filterOrganization === 'yes'} onclick={() => filterOrganization = 'yes'}>{t('filterWithOrganization')}</button>
          <button class="chip" class:active={filterOrganization === 'no'} aria-pressed={filterOrganization === 'no'} onclick={() => filterOrganization = 'no'}>{t('filterWithoutOrganization')}</button>
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-label">{t('filterMaritalStatus')}</span>
        <div class="filter-chips">
          <button class="chip" class:active={filterMaritalStatus === ''} aria-pressed={filterMaritalStatus === ''} onclick={() => filterMaritalStatus = ''}>{t('filterAll')}</button>
          <button class="chip" class:active={filterMaritalStatus === 'yes'} aria-pressed={filterMaritalStatus === 'yes'} onclick={() => filterMaritalStatus = 'yes'}>{t('filterWithMaritalStatus')}</button>
          <button class="chip" class:active={filterMaritalStatus === 'no'} aria-pressed={filterMaritalStatus === 'no'} onclick={() => filterMaritalStatus = 'no'}>{t('filterWithoutMaritalStatus')}</button>
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
    <ErrorNotice message={t('contactsLoadError')} onretry={fetchContacts} />
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
  {:else if contacts.value.length === 0 && !loadError && (activeFilters > 0 || search.value)}
    <div class="empty-state">
      <Search class="empty-state-icon" size={48} />
      <div class="empty-state-text">{t('contactsNoResults')}</div>
      <div class="empty-state-hint">{activeFilters > 0 ? t('contactsNoResultsFilters') : t('contactsNoResultsSearch')}</div>
      {#if activeFilters > 0}
        <button class="btn btn-secondary no-results-action" onclick={clearFilters}>{t('filtersClear')}</button>
      {/if}
    </div>
  {:else if contacts.value.length === 0 && !loadError}
    <div class="empty-state">
      <Search class="empty-state-icon" size={48} />
      <div class="empty-state-text">{t('contactsEmpty')}</div>
      <div class="empty-state-hint">{t('contactsEmptyHint')}</div>
    </div>
  {:else if contacts.value.length > 0}
    <div class="contacts-list">
      {#each listRows as row (row.key)}
        {#if row.letter}
          <h2 class="letter-head">{row.letter}</h2>
        {:else}
        {@const contact = row.contact}
        <div class="list-item">
        <button class="row-main" onclick={() => goto(`/contacts/${contact.contact_id}`)}>
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
        </button>
        {#if hasActions(contact)}
          <button
            class="more-btn"
            aria-haspopup="menu"
            aria-expanded={menu?.contact.contact_id === contact.contact_id}
            aria-label={`${t('contactMore')}: ${contactName(contact)}`}
            onclick={(e) => openMenu(e, contact)}
          >
            <Ellipsis size={20} />
          </button>
        {/if}
        </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if menu}
    <ContactActionsMenu phone={primaryPhone(menu.contact)} email={primaryEmail(menu.contact)} anchor={menu.trigger} onclose={closeMenu} />
  {/if}

  <button class="fab" aria-label={t('contactNew')} onclick={() => goto('/contacts/new')}>+</button>
</div>

<style>
  .contacts-page { padding-bottom: 80px; }

  .list-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .letter-head-inline {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text2);
    padding: 0 4px;
  }

  .toolbar-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
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
    background: var(--accent-strong);
    color: white;
    font-size: 0.625rem;
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
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .filter-clear {
    font-size: 0.8125rem;
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
    font-size: 0.8125rem;
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
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .chip:hover {
    border-color: var(--text2);
  }

  .chip.active {
    background: var(--accent-strong);
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
    font-size: 1rem;
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
    font-size: 0.9375rem;
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

  :global(.spin-icon) {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.spin-icon) { animation: none; opacity: 0.5; }
  }

  .letter-head {
    position: sticky;
    top: var(--search-h, 66px);
    z-index: 40;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text2);
    padding: 6px 4px;
    background: var(--bg);
  }

  @media (min-width: 601px) {
    .letter-head { top: calc(56px + var(--search-h, 66px)); }
  }

  .no-results-action { margin-top: 16px; }

  .list-item {
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .row-main {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .more-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    margin: -8px -8px -8px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--text2);
    cursor: pointer;
  }

  .more-btn:hover { background: var(--border); }

  .more-btn[aria-expanded='true'] {
    color: var(--accent-text);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }


  .list-item-content {
    flex: 1;
    min-width: 0;
  }

  .list-item-name {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

   .list-item-detail {
    font-size: 0.875rem;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
   }

   .list-item-status { font-size: 0.75rem; color: var(--text2); }
   .deceased-status { color: var(--danger-text); }


  .empty-state-hint {
    font-size: 0.875rem;
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
