<script>
  let { title, add, children } = $props();
</script>

<div class="form-card related-section">
  <div class="related-header">
    <h2 class="form-section-title">{title}</h2>
    <button type="button" class="add-button" onclick={add}>+ Agregar</button>
  </div>
  {@render children?.()}
</div>

<style>
  .form-section-title { font-size: 17px; margin-bottom: 14px; }
  .related-section { display: flex; flex-direction: column; gap: 12px; }
  .related-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .add-button { display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--accent); cursor: pointer; font: inherit; font-size: 13px; }
</style>
