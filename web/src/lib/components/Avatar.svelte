<script>
  // Contact photo with an initials fallback (no photo, or the image fails to load).
  // Sizing and colors come from the parent class; this only swaps the content.
  let { contact, size = 44, bordered = false } = $props();

  let failedUrl = $state('');
  let showPhoto = $derived(!!contact?.photo_url && failedUrl !== contact.photo_url);

  let initials = $derived.by(() => {
    const f = (contact?.first_name || '')[0] || '';
    const s = (contact?.surname || '')[0] || '';
    return (f + s).toUpperCase() || '?';
  });
</script>

<div class="avatar-box"
     class:bordered style="width:{size}px;height:{size}px;font-size:{Math.round(size * 0.36)}px">
  {#if showPhoto}
    <img src={contact.photo_url} alt="" loading="lazy" onerror={() => (failedUrl = contact.photo_url)} />
  {:else}
    {initials}
  {/if}
</div>

<style>
  .avatar-box {
    border-radius: 50%;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--accent-text);
    flex-shrink: 0;
    overflow: hidden;
  }
  .bordered {
    background: var(--surface);
    border: 2px solid var(--accent);
    font-weight: 700;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
