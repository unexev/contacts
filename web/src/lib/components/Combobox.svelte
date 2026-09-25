<script>
  import { Check, Plus } from '@lucide/svelte';

  let {
    id,
    label = '',
    placeholder = '',
    options = [],
    value = $bindable(''),
    createLabel = (text) => `+ ${text}`,
    maxlength = 120,
    onchange = () => {}
  } = $props();

  let open = $state(false);
  let active = $state(-1);
  const listId = `${id}-list`;

  const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  let query = $derived(normalize(value));
  let filtered = $derived(
    [...new Set(options.filter(Boolean))]
      .filter((option) => !query || normalize(option).includes(query))
      .slice(0, 8)
  );
  let canCreate = $derived(Boolean(query) && !options.some((option) => normalize(option) === query));
  let items = $derived([
    ...filtered.map((option) => ({ text: option, create: false })),
    ...(canCreate ? [{ text: value.trim(), create: true }] : [])
  ]);

  function choose(item) {
    value = item.text;
    open = false;
    active = -1;
    onchange(item.text);
  }

  function handleInput() {
    open = true;
    active = -1;
    onchange(value);
  }

  function handleKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open = true;
      active = Math.min(active + 1, items.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (event.key === 'Enter' && open && items[active]) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === 'Escape') {
      open = false;
    }
  }
</script>

<div class="combobox">
  {#if label}<label class="form-label" for={id}>{label}</label>{/if}
  <input
    {id}
    class="input"
    type="text"
    role="combobox"
    autocomplete="off"
    aria-autocomplete="list"
    aria-expanded={open && items.length > 0}
    aria-controls={listId}
    aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
    {placeholder}
    {maxlength}
    bind:value
    oninput={handleInput}
    onfocus={() => (open = true)}
    onblur={() => setTimeout(() => (open = false), 120)}
    onkeydown={handleKeydown}
  />
  {#if open && items.length}
    <ul class="combobox-list" id={listId} role="listbox">
      {#each items as item, i}
        <li
          id={`${id}-opt-${i}`}
          role="option"
          aria-selected={i === active}
          class="combobox-option"
          class:active={i === active}
          class:create={item.create}
          onmousedown={(event) => { event.preventDefault(); choose(item); }}
        >
          {#if item.create}
            <Plus size={16} />
            <span>{createLabel(item.text)}</span>
          {:else}
            <span>{item.text}</span>
            {#if normalize(item.text) === query}<Check size={16} class="combobox-check" />{/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .combobox {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .combobox-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 20;
    margin-top: 4px;
    padding: 4px;
    list-style: none;
    max-height: 264px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  .combobox-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 15px;
    color: var(--text);
    cursor: pointer;
  }

  .combobox-option.active {
    background: var(--surface2);
  }

  .combobox-option.create {
    justify-content: flex-start;
    color: var(--accent);
    font-weight: 500;
  }

  .combobox-option :global(.combobox-check) {
    color: var(--accent);
    flex-shrink: 0;
  }
</style>
