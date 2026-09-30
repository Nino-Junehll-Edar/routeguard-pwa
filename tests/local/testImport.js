import { describe, expect, it, vi } from 'vitest';

describe('Simple import test', () => {
  it('should be able to import authStore', async () => {
    // Try to import the module
    const authStore = await import('../src/lib/authStore.ts');
    expect(authStore).toBeDefined();
  });
});