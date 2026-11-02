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
    const instances = initMarquee({ wrapperSelector: '.non-existent' });
    expect(instances).toEqual([]);
  });

  it('should return empty array when no elements exist with default selector', async () => {
    const instances = initMarquee();
    expect(instances).toEqual([]);
  });
});

describe('initMarquee - lazy viewport init', () => {
  type Callback = (entries: { isIntersecting: boolean }[]) => void;
  let observers: { target: Element | null; callback: Callback }[];

  function reveal(target: Element) {
    for (const o of observers) {
      if (o.target === target) o.callback([{ isIntersecting: true }]);
    }
  }

  /** jsdom never fetches images, so fire `load` by hand once listeners exist. */
  async function loadImages() {
    document.querySelectorAll('img').forEach((img) => {
      img.dispatchEvent(new Event('load'));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function render(): { top: HTMLElement; bottom: HTMLElement } {
    document.body.innerHTML = `
      <div class="container" id="top"><div class="track">
        <div data-marquee><img src="a.png" data-marquee-item></div>
      </div></div>
      <div style="height: 4000px"></div>
      <div class="container" id="bottom"><div class="track">
        <div data-marquee><img src="b.png" data-marquee-item></div>
      </div></div>
    `;
    return {
      top: document.getElementById('top')!,
      bottom: document.getElementById('bottom')!,
    };
  }

  beforeEach(() => {
    observers = [];
    class FakeIntersectionObserver {
      target: Element | null = null;
      constructor(private callback: Callback) {}
      observe(el: Element) {
        this.target = el;
        observers.push(this as any);
      }
      unobserve() {}
      disconnect() {
        observers = observers.filter((o) => o !== (this as any));
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    installMatchMedia(false);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('should return instances synchronously without waiting for the page', () => {
    render();
    const marquees = initMarquee();
    expect(marquees).toHaveLength(2);
    expect(marquees[0]).toBeInstanceOf(Marquee);
    marquees.forEach((m) => m.destroy());
  });

  it('should let a visible marquee become ready while a below-fold one is pending', async () => {
    const { top } = render();
    const [first, second] = initMarquee();

    reveal(top);
    await Promise.resolve();
    await loadImages();
    await first!.ready;

    expect(first!.isReady()).toBe(true);
    expect(second!.isReady()).toBe(false);

    first!.destroy();
    second!.destroy();
  });

  it('should allow destroying a marquee that never entered the viewport', async () => {
    const { bottom } = render();
    const [_first, second] = initMarquee();

    second!.destroy();
    expect(second!.isDestroyed()).toBe(true);

    reveal(bottom);
    await second!.ready;
    expect(second!.isReady()).toBe(false);

    _first!.destroy();
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

    const [marquee] = initMarquee();
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });

  it('should opt out via data-marquee-respect-reduced-motion="false"', async () => {
    installMatchMedia(true);
    const container = renderMarkup(
      'data-marquee-respect-reduced-motion="false"',
    );

    const [marquee] = initMarquee();
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');

    marquee!.destroy();
  });

  it('should opt out via the respectReducedMotion config option', async () => {
    installMatchMedia(true);
    const container = renderMarkup();

    const [marquee] = initMarquee({ respectReducedMotion: false });
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');

    marquee!.destroy();
  });

  it('should let the element attribute override a config option that honors it', async () => {
    installMatchMedia(true);
    renderMarkup('data-marquee-respect-reduced-motion="false"');

    const [marquee] = initMarquee({ respectReducedMotion: true });
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should read the preference opt-out from a custom attribute name', async () => {
    installMatchMedia(true);
    renderMarkup('data-keep-moving="false"');

    const [marquee] = initMarquee({
      respectReducedMotionAttribute: 'data-keep-moving',
    });
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(false);

    marquee!.destroy();
  });

  it('should ignore the default attribute name when a custom one is configured', async () => {
    installMatchMedia(true);
    renderMarkup('data-marquee-respect-reduced-motion="false"');

    const [marquee] = initMarquee({
      respectReducedMotionAttribute: 'data-keep-moving',
    });
    await marquee!.ready;

    expect(marquee!.isPaused()).toBe(true);

    marquee!.destroy();
  });
});
