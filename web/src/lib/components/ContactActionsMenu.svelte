<script>
  import { onMount, tick } from 'svelte';
  import { Phone, MessageCircle, Mail, Copy } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte.js';
  import { showToast } from '$lib/toast.svelte.js';
  import { telHref, whatsappHref, mailHref, menuItemCount } from '$lib/contactActions.js';

  // Anchored quick-actions menu for one phone number and/or one email address.
  // The parent owns open/close state and the trigger; onclose(restoreFocus) is
  // called for every way of dismissing it.
  let { phone = '', email = '', anchor, onclose } = $props();

  const MENU_WIDTH = 220;
  const origin = { scrollY: window.scrollY, width: window.innerWidth };

  let menuEl = $state(null);
  let wa = $derived(whatsappHref(phone));

  function place() {
    const rect = anchor.getBoundingClientRect();
    const height = menuItemCount(phone, email) * 44 + 10;
    const below = rect.bottom + 4;
    // Flip above the trigger when there is no room before the bottom tab bar.
    const top = below + height > window.innerHeight - 72 ? Math.max(8, rect.top - height - 4) : below;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    return { top, left };
  }

  const position = place();

  onMount(async () => {
    await tick();
    menuEl?.querySelector('[role="menuitem"]')?.focus();
  });

  function onMenuKeydown(event) {
    const items = [...menuEl.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length].focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length].focus(); }
    else if (event.key === 'Home') { event.preventDefault(); items[0].focus(); }
    else if (event.key === 'End') { event.preventDefault(); items[items.length - 1].focus(); }
    else if (event.key === 'Tab') { onclose(false); }
  }

  function onWindowKeydown(event) {
    if (event.key === 'Escape') onclose(true);
  }

  function onWindowClick(event) {
    if (menuEl?.contains(event.target) || anchor.contains(event.target)) return;
    onclose(false);
  }

  // Scroll and resize events can arrive just after opening (scroll-into-view, mobile
  // address bar), so only close when the page really moved or changed width.
  function onViewportChange() {
    if (Math.abs(window.scrollY - origin.scrollY) > 4 || window.innerWidth !== origin.width) onclose(false);
  }

  async function copyNumber() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(phone);
      ok = true;
    } catch {
      const area = document.createElement('textarea');
      area.value = phone;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
    }
    onclose(true);
    showToast(ok ? t('actionCopied') : t('actionCopyFailed'));
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onclick={onWindowClick} onresize={onViewportChange} onscroll={onViewportChange} />

<div
  class="action-menu"
  role="menu"
  tabindex="-1"
  style="top: {position.top}px; left: {position.left}px"
  bind:this={menuEl}
  onkeydown={onMenuKeydown}
>
  {#if phone}
    <a class="menu-item" role="menuitem" href={telHref(phone)} onclick={() => onclose(false)}><Phone size={18} />{t('actionCall')}</a>
  {/if}
  {#if wa}
    <a class="menu-item" role="menuitem" href={wa} target="_blank" rel="noopener noreferrer" onclick={() => onclose(false)}><MessageCircle size={18} />{t('actionWhatsApp')}</a>
  {/if}
  {#if email}
    <a class="menu-item" role="menuitem" href={mailHref(email)} onclick={() => onclose(false)}><Mail size={18} />{t('actionEmail')}</a>
  {/if}
  {#if phone}
    <button class="menu-item" role="menuitem" onclick={copyNumber}><Copy size={18} />{t('actionCopyNumber')}</button>
  {/if}
</div>

<style>
  .action-menu {
    position: fixed;
    z-index: 150;
    width: 220px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .menu-item {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text);
    font: inherit;
    font-size: 0.9375rem;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .menu-item:hover,
  .menu-item:focus-visible {
    background: var(--surface2);
    text-decoration: none;
  }

  .menu-item :global(svg) { color: var(--text2); flex-shrink: 0; }
</style>
