import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Marquee, initMarquee, createMarquee } from '../index.ts';
import { installMatchMedia } from './helpers/matchMedia.ts';

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

describe('initMarquee - reduced motion plumbing', () => {
  /** Renders the required 3-level structure with optional wrapper attributes. */
  function renderMarkup(wrapperAttributes = ''): HTMLElement {
    document.body.innerHTML = `
      <div class="container">
        <div class="track">
          <div class="wrapper" data-marquee ${wrapperAttributes}>
            <span data-marquee-item>One</span>
          </div>
        </div>
      </div>
    `;

    return document.querySelector<HTMLElement>('.container')!;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('should honor the motion preference by default', async () => {
    installMatchMedia(true);
    renderMarkup();

    const [marquee] = await initMarquee();

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });

  it('should opt out via data-marquee-respect-reduced-motion="false"', async () => {
    installMatchMedia(true);
    renderMarkup('data-marquee-respect-reduced-motion="false"');

    const [marquee] = await initMarquee();

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should opt out via the respectReducedMotion config option', async () => {
    installMatchMedia(true);
    renderMarkup();

    const [marquee] = await initMarquee({ respectReducedMotion: false });

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should let the element attribute override a config option that honors it', async () => {
    installMatchMedia(true);
    renderMarkup('data-marquee-respect-reduced-motion="false"');

    const [marquee] = await initMarquee({ respectReducedMotion: true });

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should read the preference opt-out from a custom attribute name', async () => {
    installMatchMedia(true);
    renderMarkup('data-keep-moving="false"');

    const [marquee] = await initMarquee({
      respectReducedMotionAttribute: 'data-keep-moving',
    });

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should ignore the default attribute name when a custom one is configured', async () => {
    installMatchMedia(true);
    renderMarkup('data-marquee-respect-reduced-motion="false"');

    const [marquee] = await initMarquee({
      respectReducedMotionAttribute: 'data-keep-moving',
    });

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });
});
