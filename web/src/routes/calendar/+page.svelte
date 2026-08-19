<script>
  import { A, api } from '$lib/api.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight, Cake } from '@lucide/svelte';
  import { calculateAge, parseContactDate } from '$lib/date.js';

  let currentMonth = $state(new Date().getMonth());
  let currentYear = $state(new Date().getFullYear());
  let birthdays = $state({});
  let loading = $state(false);
  let selectedDay = $state(null);
  let showModal = $state(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  onMount(() => {
    if (!A.token) { goto('/'); return; }
    fetchBirthdays();
  });

  async function fetchBirthdays() {
    loading = true;
    try {
      const data = await api(`/api/birthdays?month=${currentMonth + 1}&year=${currentYear}`);
      const list = Array.isArray(data) ? data : (data?.data || data?.contacts || []);
      const map = {};
      list.forEach(c => {
        if (!c.birthdate) return;
        const d = parseContactDate(c.birthdate);
        if (d) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(c);
        }
      });
      birthdays = map;
    } catch (err) {
      if (err.message === 'unauthorized' || err.message === 'Invalid credentials') goto('/');
      birthdays = {};
    } finally {
      loading = false;
    }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
    selectedDay = null;
    fetchBirthdays();
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
    selectedDay = null;
    fetchBirthdays();
  }

  function getDaysInMonth() {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }

  function getFirstDayOfMonth() {
    return new Date(currentYear, currentMonth, 1).getDay();
  }

  function isToday(day) {
    const today = new Date();
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  }

  function selectDay(day) {
    if (birthdays[day]?.length) {
      selectedDay = day;
      showModal = true;
    }
  }

  function getAge(birthdate) {
    if (!birthdate) return '';
    const age = calculateAge(birthdate);
    return age === null ? '' : `Turns ${age} years`;
  }

  function getInitials(c) {
    const f = (c.first_name || '')[0] || '';
    const s = (c.surname || '')[0] || '';
    return (f + s).toUpperCase() || '?';
  }

  let calendarDays = $derived(() => {
    const days = [];
    const firstDay = getFirstDayOfMonth();
    const totalDays = getDaysInMonth();
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, key: `empty-${i}` });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ day: d, key: `day-${d}` });
    }
    return days;
  });

  let totalBirthdays = $derived(Object.values(birthdays).reduce((sum, arr) => sum + arr.length, 0));
</script>

<div class="calendar-page animate-in">
  <div class="calendar-header">
    <button class="btn-ghost" onclick={prevMonth}>
      <ChevronLeft size={20} />
    </button>
    <h1 class="calendar-title">{monthNames[currentMonth]} {currentYear}</h1>
    <button class="btn-ghost" onclick={nextMonth}>
      <ChevronRight size={20} />
    </button>
  </div>

  <div class="calendar-grid">
    {#each dayNames as dayName}
      <div class="day-header">{dayName}</div>
    {/each}

    {#each calendarDays() as cell}
      {#if cell.day === null}
        <div class="day-cell empty"></div>
      {:else}
        <button
          class="day-cell"
          class:today={isToday(cell.day)}
          class:has-birthday={birthdays[cell.day]?.length}
          onclick={() => selectDay(cell.day)}
        >
          <span class="day-number">{cell.day}</span>
          {#if birthdays[cell.day]?.length}
            <div class="birthday-dots">
              {#each { length: Math.min(birthdays[cell.day].length, 3) } as _, i}
                <span class="dot"></span>
              {/each}
            </div>
          {/if}
        </button>
      {/if}
    {/each}
  </div>

  {#if totalBirthdays > 0}
    <div class="birthday-count">
      <Cake size={16} />
      <span>Has birthdays ({totalBirthdays})</span>
    </div>
  {/if}
</div>

{#if showModal && selectedDay && birthdays[selectedDay]}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={() => showModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showModal = false)}
  >
    <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">{selectedDay} {monthNames[currentMonth]}</h2>
        <button class="modal-close" onclick={() => showModal = false}>X</button>
      </div>
      <div class="birthday-list">
        {#each birthdays[selectedDay] as contact}
          <button
            class="birthday-item"
            onclick={() => { showModal = false; goto(`/contacts/${contact.contact_id}`); }}
          >
            <div class="birthday-avatar">{getInitials(contact)}</div>
            <div class="birthday-info">
              <div class="birthday-name">
                {contact.first_name || ''} {contact.middle_name?.String || contact.middle_name || ''} {contact.surname || ''}
              </div>
              <div class="birthday-age">{getAge(contact.birthdate)}</div>
            </div>
            <span class="birthday-arrow">></span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .calendar-page { padding-bottom: 40px; }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .calendar-title {
    font-size: 22px;
    font-weight: 700;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 16px;
  }

  .day-header {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    padding: 8px 0;
    text-transform: uppercase;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    color: var(--text);
    gap: 4px;
  }

  .day-cell.empty {
    background: transparent;
    border-color: transparent;
    cursor: default;
  }

  .day-cell:hover:not(.empty):not(.has-birthday) {
    background: var(--surface2);
  }

  .day-cell.today {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .day-cell.has-birthday {
    border-color: var(--accent);
    background: rgba(10, 132, 255, 0.1);
  }

  .day-cell.has-birthday:hover {
    background: rgba(10, 132, 255, 0.2);
  }

  .day-number {
    font-size: 14px;
    font-weight: 500;
  }

  .birthday-dots {
    display: flex;
    gap: 3px;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .today .dot {
    background: white;
  }

  .birthday-count {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text2);
    font-size: 14px;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }

  .modal {
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--border);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: 18px;
    font-weight: 600;
  }

  .modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--surface2);
    border: none;
    color: var(--text2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-close:hover {
    background: var(--border);
    color: var(--text);
  }

  .birthday-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .birthday-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 20px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: var(--text);
    transition: background 0.15s;
  }

  .birthday-item:last-child {
    border-bottom: none;
  }

  .birthday-item:hover {
    background: var(--surface2);
  }

  .birthday-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .birthday-info {
    flex: 1;
    min-width: 0;
  }

  .birthday-name {
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .birthday-age {
    font-size: 13px;
    color: var(--text2);
  }

  .birthday-arrow {
    color: var(--text2);
    font-size: 16px;
  }
</style>
