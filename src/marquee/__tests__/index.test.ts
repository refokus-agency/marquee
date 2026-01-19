import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Note: Full integration tests with GSAP require a real browser environment.
 * These tests verify the basic API structure and edge cases.
 * For full testing, use a real browser testing framework like Playwright or Cypress.
 */
describe('Marquee Exports', () => {
  it('should export Marquee class and factory functions', async () => {
    const module = await import('../index.ts');

    // Verify exports exist
    expect(module.Marquee).toBeDefined();
    expect(typeof module.Marquee).toBe('function');
    expect(typeof module.initMarquee).toBe('function');
    expect(typeof module.createMarquee).toBe('function');
  });

  it('Marquee should be a class constructor', async () => {
    const { Marquee } = await import('../index.ts');

    // Verify it's a class (has prototype)
    expect(Marquee.prototype).toBeDefined();
    expect(typeof Marquee.prototype.pause).toBe('function');
    expect(typeof Marquee.prototype.resume).toBe('function');
    expect(typeof Marquee.prototype.isPaused).toBe('function');
    expect(typeof Marquee.prototype.setSpeed).toBe('function');
    expect(typeof Marquee.prototype.getSpeed).toBe('function');
    expect(typeof Marquee.prototype.setDirection).toBe('function');
    expect(typeof Marquee.prototype.getDirection).toBe('function');
    expect(typeof Marquee.prototype.destroy).toBe('function');
    expect(typeof Marquee.prototype.isDestroyed).toBe('function');
    expect(typeof Marquee.prototype.isReady).toBe('function');
  });

  it('Marquee should have static create method', async () => {
    const { Marquee } = await import('../index.ts');
    expect(typeof Marquee.create).toBe('function');
  });
});

describe('Marquee - No DOM', () => {
  beforeEach(() => {
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
    const instances = await initMarquee({ wrapperSelector: '.non-existent' });
    expect(instances).toEqual([]);
  });

  it('createMarquee should return null for non-existent selector', async () => {
    const { createMarquee } = await import('../index.ts');
    const instance = await createMarquee('#non-existent');
    expect(instance).toBeNull();
  });
});

describe('Marquee - DOM Structure Validation', () => {
  beforeEach(() => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  it('should throw error when wrapper has no parent (track)', async () => {
    const { Marquee } = await import('../index.ts');

    // Create element without parent
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-marquee', '');

    expect(() => new Marquee(wrapper)).toThrow(
      'Marquee wrapper must have a parent element (track)'
    );
  });

  it('should throw error when track has no parent (container)', async () => {
    const { Marquee } = await import('../index.ts');

    // Create track and wrapper, but track has no parent
    const track = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-marquee', '');
    track.appendChild(wrapper);

    expect(() => new Marquee(wrapper)).toThrow(
      'Marquee track must have a parent element (container)'
    );
  });
});
