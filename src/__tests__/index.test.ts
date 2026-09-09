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
    const container = renderMarkup(
      'data-marquee-respect-reduced-motion="false"',
    );

    const [marquee] = await initMarquee();

    expect(marquee!.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');

    marquee!.destroy();
  });

  it('should opt out via the respectReducedMotion config option', async () => {
    installMatchMedia(true);
    const container = renderMarkup();

    const [marquee] = await initMarquee({ respectReducedMotion: false });

    expect(marquee!.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');

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

describe('initMarquee - pause mechanism plumbing', () => {
  /**
   * Renders the required 3-level structure plus the pause button, which the
   * README puts in the container as a sibling of the track.
   */
  function renderMarkup(wrapperAttributes = ''): HTMLButtonElement {
    document.body.innerHTML = `
      <div class="container">
        <div class="track">
          <div class="wrapper" data-marquee ${wrapperAttributes}>
            <a href="#one" data-marquee-item>One</a>
          </div>
        </div>
        <button type="button" data-marquee-pause-button>Pause</button>
      </div>
    `;

    return document.querySelector<HTMLButtonElement>(
      '[data-marquee-pause-button]',
    )!;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  /**
   * The pause-button warnings only. jsdom measures every element as zero-sized,
   * so this markup also trips the pre-existing "wrapper measured 0" warning —
   * counting raw calls would fold the two together.
   */
  function pauseButtonWarnings(): string[] {
    return vi
      .mocked(console.warn)
      .mock.calls.map(([message]) => String(message))
      .filter((message) => message.includes('pause button'));
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should bind the pause button by default', async () => {
    installMatchMedia(false);
    const button = renderMarkup();

    const [marquee] = await initMarquee();
    button.click();

    expect(marquee!.isPaused()).toBe(true);
    expect(button.getAttribute('data-marquee-paused')).toBe('true');

    marquee!.destroy();
  });

  it('should opt out via data-marquee-pause-button-enabled="false"', async () => {
    installMatchMedia(false);
    const button = renderMarkup('data-marquee-pause-button-enabled="false"');

    const [marquee] = await initMarquee();
    button.click();

    expect(marquee!.isPaused()).toBe(false);
    expect(button.hasAttribute('data-marquee-paused')).toBe(false);

    marquee!.destroy();
  });

  it('should opt out via the pauseButton config option', async () => {
    installMatchMedia(false);
    const button = renderMarkup();

    const [marquee] = await initMarquee({ pauseButton: false });
    button.click();

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should pass pauseButtonSelector through to the instance', async () => {
    installMatchMedia(false);
    renderMarkup();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const custom = document.createElement('button');
    custom.className = 'stop';
    document.querySelector('.container')!.appendChild(custom);

    const [marquee] = await initMarquee({ pauseButtonSelector: '.stop' });
    custom.click();

    expect(marquee!.isPaused()).toBe(true);
    expect(pauseButtonWarnings()).toEqual([]);

    marquee!.destroy();
  });

  it('should leave pause-on-focus off by default', async () => {
    installMatchMedia(false);
    renderMarkup();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const [marquee] = await initMarquee();
    link.dispatchEvent(new Event('focusin', { bubbles: true }));

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should opt in via data-marquee-pause-on-focus', async () => {
    installMatchMedia(false);
    renderMarkup('data-marquee-pause-on-focus');
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const [marquee] = await initMarquee();
    link.dispatchEvent(new Event('focusin', { bubbles: true }));

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });

  it('should opt in via the pauseOnFocus config option', async () => {
    installMatchMedia(false);
    renderMarkup();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const [marquee] = await initMarquee({ pauseOnFocus: true });
    link.dispatchEvent(new Event('focusin', { bubbles: true }));

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });

  it('should read pause-on-focus from a custom attribute name', async () => {
    installMatchMedia(false);
    renderMarkup('data-hold-on-focus');
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const [marquee] = await initMarquee({
      pauseOnFocusAttribute: 'data-hold-on-focus',
    });
    link.dispatchEvent(new Event('focusin', { bubbles: true }));

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });

  it('should warn once per marquee when a page ships no pause button', async () => {
    installMatchMedia(false);
    renderMarkup();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const marquees = await initMarquee();

    expect(pauseButtonWarnings()).toEqual([
      expect.stringContaining('no pause button matching'),
    ]);

    marquees.forEach((marquee) => marquee.destroy());
  });
});
