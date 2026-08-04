import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Marquee } from '../Marquee.ts';

/**
 * Note: Full integration tests with GSAP require a real browser environment.
 * These tests verify the basic API structure and edge cases.
 * For full testing, use a real browser testing framework like Playwright or Cypress.
 */
describe('Marquee Class', () => {
  it('should be a class constructor', () => {
    expect(Marquee.prototype).toBeDefined();
  });

  it('should have static create method', () => {
    expect(typeof Marquee.create).toBe('function');
  });

  it('should have all public methods', () => {
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
});

describe('Marquee - Lazy Image Handling', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // JSDOM has no IntersectionObserver — waitForViewport resolves immediately (fallback path)
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('should flip unloaded lazy images to eager after viewport check', async () => {
    document.body.innerHTML = `
      <div class="container">
        <div class="track">
          <div class="wrapper">
            <img src="a.jpg" loading="lazy" />
          </div>
        </div>
      </div>
    `;

    const wrapper = document.querySelector<HTMLElement>('.wrapper')!;
    const img = wrapper.querySelector<HTMLImageElement>('img')!;

    // JSDOM does not implement img.loading — define it so the code branch is exercisable
    Object.defineProperty(img, 'complete', { value: false, writable: true });
    Object.defineProperty(img, 'loading', { value: 'lazy', writable: true });

    const marquee = new Marquee(wrapper);

    // Flush the waitForViewport microtask (IntersectionObserver is undefined in JSDOM → resolves immediately)
    await Promise.resolve();

    // After viewport check, lazy unloaded image should be flipped to eager
    expect(img.loading).toBe('eager');

    marquee.destroy();
  });

  it('should not change loading attribute of already-complete lazy images', async () => {
    document.body.innerHTML = `
      <div class="container">
        <div class="track">
          <div class="wrapper">
            <img src="a.jpg" loading="lazy" />
          </div>
        </div>
      </div>
    `;

    const wrapper = document.querySelector<HTMLElement>('.wrapper')!;
    const img = wrapper.querySelector<HTMLImageElement>('img')!;

    // JSDOM does not implement img.loading — define it so the assertion is meaningful
    Object.defineProperty(img, 'complete', { value: true });
    Object.defineProperty(img, 'loading', { value: 'lazy', writable: true });

    const marquee = new Marquee(wrapper);
    await Promise.resolve();

    // Already complete — should not be changed
    expect(img.loading).toBe('lazy');

    marquee.destroy();
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

  it('should throw error when wrapper has no parent (track)', () => {
    // Create element without parent
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-marquee', '');

    expect(() => new Marquee(wrapper)).toThrow(
      'Marquee wrapper must have a parent element (track)',
    );
  });

  it('should throw error when track has no parent (container)', () => {
    // Create track and wrapper, but track has no parent
    const track = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-marquee', '');
    track.appendChild(wrapper);

    expect(() => new Marquee(wrapper)).toThrow(
      'Marquee track must have a parent element (container)',
    );
  });
});

interface MarqueeFixture {
  container: HTMLElement;
  track: HTMLElement;
  wrapper: HTMLElement;
}

const WRAPPER_SIZE = 100;
const CONTAINER_SIZE = 300;

/**
 * jsdom reports every element as zero-sized, which makes measurePeriod() return
 * 0 and updateClones() compute a NaN clone count — so no clones are ever
 * created. Faking the two dimensions the marquee actually measures gives the
 * clone and wrap logic a realistic layout to work against.
 */
function buildFixture(): MarqueeFixture {
  document.body.innerHTML = `
    <div class="container">
      <div class="track">
        <div class="wrapper" data-marquee>
          <a href="#one" data-marquee-item>One</a>
        </div>
      </div>
    </div>
  `;

  const container = document.querySelector<HTMLElement>('.container')!;
  const track = document.querySelector<HTMLElement>('.track')!;
  const wrapper = document.querySelector<HTMLElement>('.wrapper')!;

  Object.defineProperty(container, 'clientWidth', {
    value: CONTAINER_SIZE,
    configurable: true,
  });
  Object.defineProperty(container, 'clientHeight', {
    value: CONTAINER_SIZE,
    configurable: true,
  });
  wrapper.getBoundingClientRect = () =>
    ({ width: WRAPPER_SIZE, height: WRAPPER_SIZE }) as DOMRect;

  return { container, track, wrapper };
}

describe('Marquee - Clone Accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('should apply inert to every clone it creates', async () => {
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.hasAttribute('inert')).toBe(true);
    });

    marquee.destroy();
  });

  it('should not use aria-hidden on clones', async () => {
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.hasAttribute('aria-hidden')).toBe(false);
    });

    marquee.destroy();
  });
});
