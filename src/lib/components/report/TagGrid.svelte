<script>
  import Icon from '$lib/components/Icon.svelte';

  export let selectedTag = '';
  export let onTagSelect = (tag) => {};

  // Hazard tags with their display names and SVG glyphs based on specification
  const tags = [
    { id: 'flood', name: 'Flooding', glyph: 'water' },
    { id: 'pothole', name: 'Pothole', glyph: 'circle' },
    { id: 'accident', name: 'Accident', glyph: 'car_crash' },
    { id: 'obstruction', name: 'Obstruction', glyph: 'construction' },
    { id: 'landslide', name: 'Landslide', glyph: 'terrain' },
    { id: 'tree', name: 'Fallen Tree', glyph: 'tree' },
    { id: 'collapse', name: 'Road Collapse', glyph: 'warning' },
    { id: 'other', name: 'Other', glyph: 'help' }
  ];

  function getTagIcon(glyphType) {
    // Map glyph types to actual Icon component names or SVG paths
    // This is a simplified mapping - in reality you'd want proper SVG glyphs
    const iconMap = {
      water: 'water_drop',
      circle: 'circle',
      car_crash: 'car_crash',
      construction: 'construction',
      terrain: 'terrain',
      tree: 'forest',
      warning: 'warning',
      help: 'help_outline'
    };

    return iconMap[glyphType] || 'help_outline';
  }
</script>

<div class="tag-grid">
  {#each tags as tag}
    <button
      class:selected={selectedTag === tag.id}
      onclick={() => onTagSelect(tag.id)}
      class="tag-btn"
    >
      <div class="tag-glyph">
        <!-- Using Icon component for now, would be replaced with custom SVGs per spec -->
        <Icon name={getTagIcon(tag.glyph)} class="tag-icon" />
      </div>
      <div class="tag-name">{tag.name}</div>
    </button>
  {/each}
</div>

<style>
  .tag-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .tag-btn {
    aspect-ratio: 1;
    border: 2px solid var(--border);
    border-radius: var(--r-m);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    text-align: center;
  }

  .tag-btn:hover {
    border-color: var(--primary);
    background: var(--primary-surface);
    transform: translateY(-2px);
  }

  .tag-btn.selected {
    border-color: var(--primary);
    background: var(--primary-surface);
    color: var(--primary);
  }

  .tag-btn.selected .tag-icon {
    color: var(--primary);
  }

  .tag-glyph {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tag-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .tag-name {
    font-weight: 600;
    font-size: 13px;
    line-height: 1.3;
  }

  /* Dark mode adjustments */
  [data-theme=dark] .tag-btn {
    border-color: var(--border);
    background: var(--surface);
  }

  [data-theme=dark] .tag-btn:hover {
    border-color: var(--primary);
    background: var(--primary-surface);
  }

  [data-theme=dark] .tag-btn.selected {
    border-color: var(--primary);
    background: var(--primary-surface);
    color: var(--primary);
  }
</style>