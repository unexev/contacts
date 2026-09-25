<script>
  let { title, add, disabled = false, disabledHint = '', children } = $props();
</script>

<div class="form-card related-section">
  <div class="related-header">
    <h2 class="form-section-title">{title}</h2>
    <button type="button" class="add-button" onclick={add} disabled={disabled} aria-disabled={disabled}>+ Agregar</button>
  </div>
  {#if disabled && disabledHint}<p class="related-limit-hint">{disabledHint}</p>{/if}
  {@render children?.()}
</div>

<style>
  .form-section-title { font-size: 17px; margin-bottom: 14px; }
  .related-section { display: flex; flex-direction: column; gap: 12px; }
  .related-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .add-button { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--accent); cursor: pointer; font: inherit; font-size: 13px; }
  .add-button:disabled { opacity: 0.5; cursor: not-allowed; }
  .related-limit-hint { margin: -4px 0 0; color: var(--text2); font-size: 13px; }
</style>
