import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Note: Full integration tests with GSAP require a real browser environment.
 * These tests verify the basic API structure and edge cases.
 * For full testing, use a real browser testing framework like Playwright or Cypress.
 */
describe('Marquee Types', () => {
  it('should export the correct types', async () => {
    const module = await import('../index.ts');
    
    // Verify exports exist
    expect(typeof module.initMarquee).toBe('function');
    expect(typeof module.createMarquee).toBe('function');
  });
});

describe('Marquee - No DOM', () => {
  beforeEach(() => {
    // Ensure clean state
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  it('initMarquee should return empty array when no elements match', async () => {
    const { initMarquee } = await import('../index.ts');
    const instances = initMarquee({ wrapperSelector: '.non-existent' });
    expect(instances).toEqual([]);
  });

  it('createMarquee should return null for non-existent selector', async () => {
    const { createMarquee } = await import('../index.ts');
    const instance = createMarquee('#non-existent');
    expect(instance).toBeNull();
  });
});
