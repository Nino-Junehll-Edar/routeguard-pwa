<script>
  import { onMount, onDestroy, tick } from 'svelte';

  export let items = []; // Array of items to render
  export let itemHeight = 50; // Height of each item in pixels (can be function for variable height)
  export let overscan = 5; // Number of extra items to render above/below viewport
  export let headerHeight = 0; // Height of fixed header (if any)
  export let footerHeight = 0; // Height of fixed footer (if any)

  // Internal state
  let container = null;
  let content = null;
  let visibleStart = 0;
  let visibleEnd = 0;
  let totalHeight = 0;
  let scrollTop = 0;
  let resizeObserver = null;
  let animationFrame = null;

  // Calculate item height (can be number or function)
  function getItemHeight(index) {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  }

  // Calculate total height of all items
  function calculateTotalHeight() {
    if (!items.length) return 0;
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight;
    }
    // For variable height, we need to measure or estimate
    // For simplicity, we'll use average height based on first few items
    const sampleSize = Math.min(20, items.length);
    let total = 0;
    for (let i = 0; i < sampleSize; i++) {
      total += getItemHeight(i);
    }
    const averageHeight = total / sampleSize;
    return items.length * averageHeight;
  }

  // Update visible item range based on scroll position
  function updateVisibleRange() {
    if (!container) return;

    const containerHeight = container.clientHeight;
    const viewTop = scrollTop - headerHeight;
    const viewBottom = viewTop + containerHeight + footerHeight;

    // Calculate start and end indices
    let start = 0;
    let accumulatedHeight = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i);
      if (accumulatedHeight >= viewTop) {
        start = Math.max(0, i - overscan);
        break;
      }
    }

    // Find end index
    accumulatedHeight = 0;
    let end = items.length;
    for (let i = 0; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i);
      if (accumulatedHeight > viewBottom) {
        end = Math.min(items.length, i + overscan + 1);
        break;
      }
    }

    // Only update if changed significantly
    if (Math.abs(start - visibleStart) > 2 || Math.abs(end - visibleEnd) > 2) {
      visibleStart = start;
      visibleEnd = end;
      tick(); // Trigger re-render
    }
  }

  // Handle scroll event
  function handleScroll(e) {
    scrollTop = e.target.scrollTop;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(updateVisibleRange);
  }

  // Handle resize
  function handleResize() {
    totalHeight = calculateTotalHeight();
    if (content) {
      content.style.height = `${totalHeight}px`;
    }
    updateVisibleRange();
  }

  // Initialize
  onMount(() => {
    totalHeight = calculateTotalHeight();
    updateVisibleRange();

    // Set up resize observer for container size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      if (container) {
        resizeObserver.observe(container);
      }
    }
  });

  // Cleanup
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
</script>

<div
  bind:this={container}
  class="virtual-list-container"
  style="position: relative; overflow: auto; width: 100%; height: 100%;"
  on:scroll={handleScroll}
>
  <div
    bind:this={content}
    class="virtual-list-content"
    style="position: absolute; top: 0; left: 0; width: 100%;"
  >
    <!-- Spacer before visible items -->
    <div
      style={{
        position: 'absolute',
        top: `${visibleStart > 0 ?
          Array.from({length: visibleStart}, (_, i) => getItemHeight(i)).reduce((a, b) => a + b, 0) : 0}px`,
        left: 0,
        width: '100%',
        height: `${visibleStart > 0 ?
          Array.from({length: visibleStart}, (_, i) => getItemHeight(i)).reduce((a, b) => a + b, 0) : 0}px`,
        pointerEvents: 'none'
      }}
    ></div>

    <!-- Visible items -->
    {#if items.length > 0}
      {#each items.slice(visibleStart, visibleEnd) as item, index (index)}
        <div
          style={{
            position: 'absolute',
            top: `${
              Array.from({length: visibleStart + index}, (_, i) => getItemHeight(i))
                .reduce((a, b) => a + b, 0) -
              Array.from({length: visibleStart}, (_, i) => getItemHeight(i))
                .reduce((a, b) => a + b, 0)
            }px`,
            left: 0,
            width: '100%',
            height: `${getItemHeight(visibleStart + index)}px`,
            pointerEvents: 'all'
          }}
        >
          <slot
            let:item
            let:index
            data-index={visibleStart + index}
          >
            <!-- Default slot content -->
            <div class="virtual-list-item">
              {#if typeof item === 'string'}{item}{:else if typeof item === 'object' && item !== null}
                {#if item.name}{item.name}{:else}{JSON.stringify(item)}{/if}
              {:else}{item}
              {/if}
            </div>
          </slot>
        </div>
      {/each}
    {/if}

    <!-- Spacer after visible items -->
    <div
      style={{
        position: 'absolute',
        top: `${
          Array.from({length: visibleEnd}, (_, i) => getItemHeight(i))
            .reduce((a, b) => a + b, 0)
        }px`,
        left: 0,
        width: '100%',
        height: `${
          Array.from({length: items.length - visibleEnd}, (_, i) =>
            getItemHeight(visibleEnd + i)
          ).reduce((a, b) => a + b, 0)
        }px`,
        pointerEvents: 'none'
      }}
    ></div>
  </div>
</div>