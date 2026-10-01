<script>
  let { currentStep, onStepChange, onSubmit, onPrevious, canProceed, isSubmitting } = $props();

  // The exported let variables are already reactive and will update when props change
  // No additional synchronization needed for basic prop passing
  // The bind: syntax in the parent would work automatically with these exported variables

  const steps = [
    { id: 1, label: 'Tag', icon: 'tag' },
    { id: 2, label: 'Details', icon: 'description' },
    { id: 3, label: 'Review', icon: 'preview' }
  ];

  function goToStep(step) {
    if (step >= 1 && step <= 3) {
      currentStep = step;
      onStepChange(step);
    }
  }

  function nextStep() {
    if (currentStep < 3) {
      goToStep(currentStep + 1);
    }
  }

  function previousStep() {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
      onPrevious();
    }
  }

  function handleSubmit() {
    if (canProceed && currentStep === 3) {
      isSubmitting = true;
      onSubmit().finally(() => {
        isSubmitting = false;
      });
    }
  }
</script>

<div class="stepper">
  <div class="step-progress">
    {#each steps as step, index}
      <div class="step"
           class:current={currentStep === step.id}
           class:completed={currentStep > step.id}
           class:available={currentStep >= step.id || index === 0}>
        <div class="step-circle">
          {#if currentStep > step.id}
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 16l-4-4 1.41-1.41L9 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          {:else if currentStep === step.id}
            <span class="step-number">{step.id}</span>
          {:else}
            <span class="step-number">{step.id}</span>
          {/if}
        </div>
        <div class="step-label">{step.label}</div>
        {#if index < steps.length - 1}
          <div class="step-divider"></div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="step-content">
    {#if currentStep === 1}
      <slot name="tag"/>
    {:else if currentStep === 2}
      <slot name="details"/>
    {:else if currentStep === 3}
      <slot name="review"/>
    {/if}
  </div>

  <div class="step-actions">
    {#if currentStep > 1}
      <button onclick={previousStep} class="btn-outline" disabled={isSubmitting}>
        Previous
      </button>
    {/if}

    {#if currentStep < 3}
      <button onclick={nextStep} class="btn-primary" disabled={!canProceed || isSubmitting}>
        {#if currentStep === 2}Next{:else}Submit Hazard{/if}
      </button>
    {:else}
      <button onclick={handleSubmit} class="btn-primary" disabled={!canProceed || isSubmitting}>
        {#if isSubmitting}Submitting...{:else}Report Hazard{/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .stepper {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-l);
    padding: 24px;
  }

  .step-progress {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    position: relative;
  }

  .step-progress::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--border);
    z-index: 0;
  }

  .step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    text-align: center;
    padding: 0 8px;
  }

  .step-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
    background: var(--surface);
    border: 2px solid var(--border);
    color: var(--ink2);
    transition: all 0.2s ease;
  }

  .step.current .step-circle {
    border-color: var(--primary);
    background: var(--primary-surface);
    color: var(--primary);
  }

  .step.completed .step-circle {
    border-color: var(--success);
    background: var(--success-sf);
    color: var(--success);
  }

  .step-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink2);
  }

  .step.current .step-label {
    color: var(--primary);
    font-weight: 700;
  }

  .step.completed .step-label {
    color: var(--success);
  }

  .step-divider {
    width: 100%;
    height: 2px;
    background: var(--border);
    position: relative;
    z-index: 0;
  }

  .step-completed .step-divider {
    background: var(--success);
  }

  .step-content {
    min-height: 200px;
  }

  .step-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .btn-outline {
    padding: 8px 16px;
    border-radius: var(--r-m);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-outline:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  .btn-outline:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-outline:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    padding: 8px 16px;
    border-radius: var(--r-m);
    background: var(--primary);
    color: var(--primary-ink);
    border: none;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark, #174a8c);
  }

  .btn-primary:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Dark mode */
  [data-theme=dark] .stepper {
    border-color: var(--border);
    background: var(--surface);
  }

  [data-theme=dark] .step-progress::before {
    background: var(--border);
  }

  [data-theme=dark] .step-circle {
    border-color: var(--border);
    background: var(--surface);
    color: var(--ink2);
  }

  [data-theme=dark] .step.current .step-circle {
    border-color: var(--primary);
    background: var(--primary-surface);
    color: var(--primary);
  }

  [data-theme=dark] .step.completed .step-circle {
    border-color: var(--success);
    background: var(--success-sf);
    color: var(--success);
  }

  [data-theme=dark] .step.label {
    color: var(--ink2);
  }

  [data-theme=dark] .step.current .step-label {
    color: var(--primary);
  }

  [data-theme=dark] .step.completed .step-label {
    color: var(--success);
  }

  [data-theme=dark] .step-divider {
    background: var(--border);
  }

  [data-theme=dark] .step-completed .step-divider {
    background: var(--success);
  }

  [data-theme=dark] .btn-outline {
    border-color: var(--border);
    color: var(--ink);
  }

  [data-theme=dark] .btn-outline:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  [data-theme=dark] .btn-primary {
    background: var(--primary);
    color: var(--primary-ink);
  }

  [data-theme=dark] .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark, #174a8c);
  }
</style>