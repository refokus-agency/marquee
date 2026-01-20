import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Marquee, initMarquee, createMarquee } from '../index.ts';

describe('Module Exports', () => {
  it('should export Marquee class', () => {
    expect(Marquee).toBeDefined();
    expect(typeof Marquee).toBe('function');
  });

  it('should export initMarquee function', () => {
    expect(initMarquee).toBeDefined();
    expect(typeof initMarquee).toBe('function');
  });

  it('should export createMarquee function', () => {
    expect(createMarquee).toBeDefined();
    expect(typeof createMarquee).toBe('function');
  });
});

describe('initMarquee', () => {
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

  it('should return empty array when no elements match', async () => {
    const instances = await initMarquee({ wrapperSelector: '.non-existent' });
    expect(instances).toEqual([]);
  });

  it('should return empty array when no elements exist with default selector', async () => {
    const instances = await initMarquee();
    expect(instances).toEqual([]);
  });
});

describe('createMarquee', () => {
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

  it('should return null for non-existent selector', async () => {
    const instance = await createMarquee('#non-existent');
    expect(instance).toBeNull();
  });

  it('should return null for non-existent element', async () => {
    const instance = await createMarquee('.does-not-exist');
    expect(instance).toBeNull();
  });
});
