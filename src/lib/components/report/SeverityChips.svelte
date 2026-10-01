<script>
  const { selectedSeverity, onSeveritySelect } = $props();

  const severities = [
    { id: 'passable', label: 'Passable', color: 'caution' }, // Yellow
    { id: 'one_lane', label: 'One lane', color: 'warning' }, // Amber
    { id: 'impassable', label: 'Impassable', color: 'danger' } // Red
  ];
</script>

<div class="severity-chips">
  {#each severities as severity}
    <button
      class:selected={selectedSeverity === severity.id}
      data-severity={severity.id}
      onclick={() => onSeveritySelect(severity.id)}
      class="severity-chip"
    >
      {severity.label}
    </button>
  {/each}
</div>

<style>
  .severity-chips {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .severity-chip {
    flex: 1;
    min-height: 48px;
    border: 2px solid var(--border);
    border-radius: var(--r-m);
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--surface);
    color: var(--ink);
  }

  .severity-chip:hover:not(.selected) {
    border-color: var(--primary);
    background: var(--primary-surface);
  }

  .severity-chip.selected {
    border-color: var(--primary);
    color: var(--primary-ink);
    font-weight: 700;
  }

  /* Color-specific styling */
  .severity-chip[data-severity="passable"] {
    --chip-color: var(--caution);
  }

  .severity-chip[data-severity="one_lane"] {
    --chip-color: var(--warning);
  }

  .severity-chip[data-severity="impassable"] {
    --chip-color: var(--danger);
  }

  /* Apply severity-specific colors when selected */
  .severity-chip.selected[data-severity="passable"] {
    background: var(--caution-sf);
    color: var(--caution);
  }

  .severity-chip.selected[data-severity="one_lane"] {
    background: var(--warning-sf);
    color: var(--warning);
  }

  .severity-chip.selected[data-severity="impassable"] {
    background: var(--danger-sf);
    color: var(--danger);
  }

  /* Hover effects for non-selected chips */
  .severity-chip:not(.selected):hover[data-severity="passable"] {
    border-color: var(--caution);
    background: var(--caution-sf);
  }

  .severity-chip:not(.selected):hover[data-severity="one_lane"] {
    border-color: var(--warning);
    background: var(--warning-sf);
  }

  .severity-chip:not(.selected):hover[data-severity="impassable"] {
    border-color: var(--danger);
    background: var(--danger-sf);
  }

  /* Dark mode */
  [data-theme=dark] .severity-chip {
    border-color: var(--border);
    background: var(--surface);
    color: var(--ink);
  }

  [data-theme=dark] .severity-chip:hover:not(.selected) {
    border-color: var(--primary);
    background: var(--primary-surface);
  }

  [data-theme=dark] .severity-chip.selected {
    border-color: var(--primary);
    color: var(--primary-ink);
  }

  [data-theme=dark] .severity-chip.selected[data-severity="passable"] {
    background: var(--caution);
    color: var(--caution-sf);
  }

  [data-theme=dark] .severity-chip.selected[data-severity="one_lane"] {
    background: var(--warning);
    color: var(--warning-sf);
  }

  [data-theme=dark] .severity-chip.selected[data-severity="impassable"] {
    background: var(--danger);
    color: var(--danger-sf);
  }

  /* Attribute selector for data-severity (would need to be set in markup) */
</style>