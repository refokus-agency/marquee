import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';
import { Marquee } from '../Marquee.ts';
import type { MarqueeOptions } from '../types.ts';
import {
  installMatchMedia,
  installUnsupportedMatchMedia,
  removeMatchMedia,
} from './helpers/matchMedia.ts';

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

/** A frame long enough to move the track a visible distance in one advance. */
const FRAME_DELTA_MS = 100;

/** The shape `gsap.ticker.add()` receives, and the marquee's per-frame advance. */
type TickerCallback = (time: number, deltaTime: number) => void;

/**
 * Drives GSAP's global timeline forward by hand.
 *
 * jsdom never advances it between assertions, so a tween left in flight simply
 * never applies another value — which is exactly how a freeze that forgets to
 * retire its tween can look correct to a test suite. Anything asserting that a
 * transform *stays* put has to step past the tween's duration first.
 */
function advanceGlobalTimeline(seconds: number): void {
  gsap.updateRoot(gsap.globalTimeline.time() + seconds);
}

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

describe('Marquee - Reduced Motion', () => {
  let tickerLog: { type: 'add' | 'remove'; callback: unknown }[];

  /**
   * Whether the marquee is advancing is only observable through ticker
   * registration — asserting real motion is not feasible without a browser.
   * This is the one white-box seam in the suite.
   *
   * Replayed in order rather than diffed by call count, because
   * `gsap.ticker.add()` de-dupes by calling `remove()` on its way in: a plain
   * adds-minus-removes count nets every registration to zero.
   */
  function liveTickerCallbacks(): unknown[] {
    const live = new Set<unknown>();

    tickerLog.forEach(({ type, callback }) => {
      if (type === 'add') live.add(callback);
      else live.delete(callback);
    });

    return Array.from(live);
  }

  function observersOn(track: HTMLElement): Observer[] {
    return Observer.getAll().filter((observer) => observer.target === track);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    tickerLog = [];

    const originalAdd = gsap.ticker.add.bind(gsap.ticker);
    const originalRemove = gsap.ticker.remove.bind(gsap.ticker);

    // Logged after the call-through so add()'s internal de-dupe remove() is
    // recorded first and cannot cancel the registration it precedes.
    vi.spyOn(gsap.ticker, 'add').mockImplementation((callback, ...rest) => {
      const result = originalAdd(callback, ...rest);
      tickerLog.push({ type: 'add', callback });
      return result;
    });
    vi.spyOn(gsap.ticker, 'remove').mockImplementation((callback, ...rest) => {
      tickerLog.push({ type: 'remove', callback });
      return originalRemove(callback, ...rest);
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should not register the ticker when the preference is already active', async () => {
    installMatchMedia(true);
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(liveTickerCallbacks()).toHaveLength(0);

    marquee.destroy();
  });

  it('should register the ticker when the preference is not active', async () => {
    installMatchMedia(false);
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(liveTickerCallbacks()).toHaveLength(1);
    expect(marquee.isPaused()).toBe(false);

    marquee.destroy();
  });

  it('should report isPaused() as true while reduced motion is active', async () => {
    installMatchMedia(true);
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(marquee.isPaused()).toBe(true);

    marquee.destroy();
  });

  it('should not begin advancing when resume() is called under reduced motion', async () => {
    installMatchMedia(true);
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    marquee.resume();

    expect(liveTickerCallbacks()).toHaveLength(0);
    expect(marquee.isPaused()).toBe(true);

    marquee.destroy();
  });

  it('should reset the track transform to 0 when reduced motion becomes active', async () => {
    const media = installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    gsap.set(track, { x: -42 });
    expect(Number(gsap.getProperty(track, 'x'))).toBe(-42);

    await media.flip(true);

    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    marquee.destroy();
  });

  it('should hold the track at 0 once the in-flight tween would have landed', async () => {
    const media = installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    // The freeze has to survive the tween the ticker leaves in flight, which
    // has up to `dragEase` seconds still to run. Only the real ticker callback
    // starts one, so drive a single frame of it by hand.
    const [advanceFrame] = liveTickerCallbacks() as TickerCallback[];
    advanceFrame(0, FRAME_DELTA_MS);

    // Partway into the tween: proves it is genuinely mid-flight, so the
    // assertions below cannot pass just because nothing was ever animating.
    advanceGlobalTimeline(0.1);
    expect(Number(gsap.getProperty(track, 'x'))).not.toBe(0);

    await media.flip(true);
    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    // Past `dragEase`. A surviving tween would have pulled the track back to
    // its pre-freeze offset by now — the whole bug this guards against.
    advanceGlobalTimeline(1);

    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    marquee.destroy();
  });

  it('should still drive the track through moveTo after a freeze/unfreeze', async () => {
    const media = installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    await media.flip(true);
    await media.flip(false);

    // Motion resumes through the same quickTo the freeze had to stand down, so
    // re-registering the ticker is not enough — the function itself has to still
    // move the track. Killing the tween instead of pausing it passes every other
    // assertion in this suite and fails here.
    const [advanceFrame] = liveTickerCallbacks() as TickerCallback[];
    advanceFrame(0, FRAME_DELTA_MS);
    advanceGlobalTimeline(1);

    expect(Number(gsap.getProperty(track, 'x'))).not.toBe(0);

    marquee.destroy();
  });

  it('should apply a scroll overflow on the horizontal axis for ltr/rtl', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { direction: 'rtl' });
    await marquee.ready;

    expect(container.style.overflowX).toBe('auto');
    expect(container.style.overflowY).toBe('');

    marquee.destroy();
  });

  it('should apply a scroll overflow on the vertical axis for ttb/btt', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { direction: 'ttb' });
    await marquee.ready;

    expect(container.style.overflowY).toBe('auto');
    expect(container.style.overflowX).toBe('');

    marquee.destroy();
  });

  it('should restore an overflow the integrator had already set inline', async () => {
    const media = installMatchMedia(false);
    const { container, wrapper } = buildFixture();
    container.style.overflowX = 'clip';

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    await media.flip(true);
    expect(container.style.overflowX).toBe('auto');

    await media.flip(false);

    expect(container.style.overflowX).toBe('clip');

    marquee.destroy();
  });

  it('should clear the overflow declaration when none was set inline', async () => {
    const media = installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(container.style.overflowX).toBe('auto');

    await media.flip(false);

    expect(container.style.overflowX).toBe('');

    marquee.destroy();
  });

  it('should reset the scrollable axis offset when reduced motion becomes inactive', async () => {
    const media = installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    // The user scrolled the frozen marquee. overflow: hidden preserves that
    // offset, so without a reset the marquee would animate from it.
    container.scrollLeft = 500;
    // The vertical axis was never made scrollable, so this offset is the page's
    // (scrollIntoView, focus) — not ours to clear.
    container.scrollTop = 300;

    await media.flip(false);

    expect(container.scrollLeft).toBe(0);
    expect(container.scrollTop).toBe(300);

    marquee.destroy();
  });

  it('should leave the frozen container alone when setDirection() crosses axes', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(container.style.overflowX).toBe('auto');

    // The user scrolled the frozen marquee along the horizontal axis.
    container.scrollLeft = 250;

    marquee.setDirection('ttb');

    // The call is refused, so the horizontal axis is still the animated one and
    // still the one that has to stay reachable. Moving the declaration — as this
    // used to do defensively — would hand that axis back to the stylesheet's
    // `overflow: hidden`, which PRESERVES the offset, stranding the content
    // 250px off-screen with no scrollbar left to bring it back.
    expect(container.style.overflowX).toBe('auto');
    expect(container.style.overflowY).toBe('');
    expect(container.scrollLeft).toBe(250);
    expect(warn).toHaveBeenCalledOnce();

    marquee.destroy();
  });

  it('should follow a same-axis setDirection() with the overflow it already had', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    marquee.setDirection('rtl');

    expect(marquee.getDirection()).toBe('rtl');
    expect(container.style.overflowX).toBe('auto');
    expect(container.style.overflowY).toBe('');

    marquee.destroy();
  });

  it('should restore the container on destroy() while reduced motion is active', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    container.scrollLeft = 500;
    container.scrollTop = 300;

    marquee.destroy();

    expect(container.style.overflowX).toBe('');
    expect(container.scrollLeft).toBe(0);
    expect(container.scrollTop).toBe(300);
    expect(liveTickerCallbacks()).toHaveLength(0);
  });

  it('should leave the container scroll untouched on destroy() when it never froze', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { respectReducedMotion: false });
    await marquee.ready;

    // Offsets the page put there. The library never made this container
    // scrollable, so destroy() has no business zeroing them.
    container.scrollLeft = 500;
    container.scrollTop = 300;

    marquee.destroy();

    expect(container.scrollLeft).toBe(500);
    expect(container.scrollTop).toBe(300);
  });

  it('should resume motion when reduced motion becomes inactive', async () => {
    const media = installMatchMedia(true);
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(liveTickerCallbacks()).toHaveLength(0);

    await media.flip(false);

    expect(liveTickerCallbacks()).toHaveLength(1);
    expect(marquee.isPaused()).toBe(false);

    marquee.destroy();
  });

  it('should kill the drag Observer under reduced motion and re-create it on exit', async () => {
    const media = installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { draggable: true });
    await marquee.ready;
    expect(observersOn(track)).toHaveLength(1);

    await media.flip(true);
    expect(observersOn(track)).toHaveLength(0);

    await media.flip(false);

    expect(observersOn(track)).toHaveLength(1);

    marquee.destroy();
  });

  it('should keep the track transform at 0 when a resize fires under reduced motion', async () => {
    // gsap.utils.wrap(-N, 0)(0) returns -N because the max is exclusive, so an
    // unguarded re-wrap would silently displace a frozen marquee.
    vi.useFakeTimers();
    installMatchMedia(true);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(200);

    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    marquee.destroy();
  });

  it('should leave the track at 0 after destroy()', async () => {
    // destroy() ends with a gsap.set to 0, but stopMotion() only deregisters
    // the ticker — the tween that ticker's last frame started is still in
    // flight and writes the axis over the reset. README documents destroy() as
    // resetting transforms, and an integrator that reuses the track after a
    // route change inherits whatever offset the survivor lands on.
    installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const [advanceFrame] = liveTickerCallbacks() as TickerCallback[];
    advanceFrame(0, FRAME_DELTA_MS);

    advanceGlobalTimeline(0.1);
    expect(Number(gsap.getProperty(track, 'x'))).not.toBe(0);

    marquee.destroy();
    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    advanceGlobalTimeline(1);

    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);
  });

  it('should hold the track at 0 when reduced motion follows a resize', async () => {
    // The test above starts with the preference already active, so no ticker
    // ever ran and no tween ever existed. Here one does — and the resize
    // replaces the quickTo that owns it, putting the tween beyond the reach of
    // the freeze unless the replacement retires it.
    vi.useFakeTimers();
    const media = installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const [advanceFrame] = liveTickerCallbacks() as TickerCallback[];
    advanceFrame(0, FRAME_DELTA_MS);

    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(200);

    // media.flip() waits out GSAP's throttle on a real timer.
    vi.useRealTimers();

    // Partway into the orphaned tween, so the assertions below cannot pass just
    // because nothing was ever animating.
    advanceGlobalTimeline(0.1);
    expect(Number(gsap.getProperty(track, 'x'))).not.toBe(0);

    await media.flip(true);
    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    // Past `dragEase`. A tween the resize orphaned is still writing the axis
    // here, and wins over the freeze's gsap.set.
    advanceGlobalTimeline(1);

    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);

    marquee.destroy();
  });

  it('should animate and read no overflow when respectReducedMotion is false', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { respectReducedMotion: false });
    await marquee.ready;

    expect(liveTickerCallbacks()).toHaveLength(1);
    expect(marquee.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');
    expect(container.style.overflowY).toBe('');

    marquee.destroy();
  });

  it('should animate without throwing when matchMedia is unavailable', async () => {
    removeMatchMedia();
    const { wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await expect(marquee.ready).resolves.toBeUndefined();

    expect(liveTickerCallbacks()).toHaveLength(1);

    marquee.destroy();
  });

  it('should animate when matchMedia exists but the feature is unsupported', async () => {
    installUnsupportedMatchMedia();
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    // Distinct from the missing-matchMedia case: the feature-detect guard passes,
    // a real query is registered, and it simply never matches. Gating on `reduce`
    // is what makes this safe — a `no-preference` gate would not match either,
    // leaving the marquee permanently dead.
    expect(liveTickerCallbacks()).toHaveLength(1);
    expect(marquee.isPaused()).toBe(false);
    expect(container.style.overflowX).toBe('');

    marquee.destroy();
  });

  it('should freeze every instance independently when several share the page', async () => {
    const media = installMatchMedia(false);
    document.body.innerHTML = `
      <div class="container-a"><div class="track"><div class="wrapper-a" data-marquee>
        <a href="#a" data-marquee-item>A</a>
      </div></div></div>
      <div class="container-b"><div class="track"><div class="wrapper-b" data-marquee>
        <a href="#b" data-marquee-item>B</a>
      </div></div></div>
    `;

    const setUp = (suffix: string) => {
      const container = document.querySelector<HTMLElement>(
        `.container-${suffix}`,
      )!;
      const wrapper = document.querySelector<HTMLElement>(
        `.wrapper-${suffix}`,
      )!;
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
      return { container, wrapper };
    };

    const a = setUp('a');
    const b = setUp('b');

    const marqueeA = new Marquee(a.wrapper);
    const marqueeB = new Marquee(b.wrapper, { direction: 'ttb' });
    await Promise.all([marqueeA.ready, marqueeB.ready]);

    expect(liveTickerCallbacks()).toHaveLength(2);

    await media.flip(true);

    // GSAP's `_media` registry is module-global, so a shared-state bug would
    // show up as one instance freezing and the other not — or as one writing on
    // the other's container. Each must freeze on its OWN axis.
    expect(marqueeA.isPaused()).toBe(true);
    expect(marqueeB.isPaused()).toBe(true);
    expect(liveTickerCallbacks()).toHaveLength(0);
    expect(a.container.style.overflowX).toBe('auto');
    expect(a.container.style.overflowY).toBe('');
    expect(b.container.style.overflowY).toBe('auto');
    expect(b.container.style.overflowX).toBe('');

    // Destroying one must not strand the other frozen.
    marqueeA.destroy();
    await media.flip(false);

    expect(marqueeB.isPaused()).toBe(false);
    expect(b.container.style.overflowY).toBe('');
    expect(a.container.style.overflowX).toBe('');

    marqueeB.destroy();
  });

  it('should keep pauseOnHover harmless while reduced motion holds it frozen', async () => {
    const media = installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { pauseOnHover: true });
    await marquee.ready;

    // Hover fires pause()/resume() on a marquee the preference already froze.
    // Neither may leak into the frozen state or survive the flip back.
    container.dispatchEvent(new Event('mouseenter'));
    expect(marquee.isPaused()).toBe(true);

    container.dispatchEvent(new Event('mouseleave'));
    expect(marquee.isPaused()).toBe(true);

    await media.flip(false);

    expect(marquee.isPaused()).toBe(false);
    expect(liveTickerCallbacks()).toHaveLength(1);

    // Proves the assertions above were not vacuous: the same listeners DO move
    // isPaused() once the preference stops overriding them.
    container.dispatchEvent(new Event('mouseenter'));
    expect(marquee.isPaused()).toBe(true);
    container.dispatchEvent(new Event('mouseleave'));
    expect(marquee.isPaused()).toBe(false);

    marquee.destroy();
  });

  it('should stop responding to preference changes after destroy()', async () => {
    const media = installMatchMedia(false);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    marquee.destroy();

    // destroy() kills the gsap.matchMedia() instance, which deregisters its
    // context. A surviving context would still write on a container the marquee
    // no longer owns.
    await media.flip(true);

    expect(container.style.overflowX).toBe('');
    expect(liveTickerCallbacks()).toHaveLength(0);
  });
});

describe('Marquee - Clone Accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('should not build clones when the wrapper measures 0', async () => {
    // `Math.ceil((300 * 2) / 0)` is Infinity, so the append loop never
    // terminates and takes the tab with it. jsdom's default hides this because
    // BOTH dimensions are 0, which yields NaN and a loop that never runs — the
    // container here keeps its faked size, which is the reachable half.
    // Without the guard this test kills the worker rather than failing.
    const { track, wrapper } = buildFixture();
    wrapper.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(track.querySelectorAll('[data-marquee-clone]')).toHaveLength(0);

    marquee.destroy();
  });

  it('should apply aria-hidden to every clone it creates', async () => {
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.getAttribute('aria-hidden')).toBe('true');
    });

    marquee.destroy();
  });

  it('should take focusable descendants of a clone out of the tab order', async () => {
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clonedLinks = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone] a[href]'),
    );

    // aria-hidden alone would leave these tabbable — a focusable element with
    // no accessible name, which is worse than the duplicate it replaces.
    expect(clonedLinks.length).toBeGreaterThan(0);
    clonedLinks.forEach((link) => {
      expect(link.getAttribute('tabindex')).toBe('-1');
    });

    marquee.destroy();
  });

  it('should take a clone that is itself focusable out of the tab order', async () => {
    const { track, wrapper } = buildFixture();
    wrapper.setAttribute('tabindex', '0');

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    // querySelectorAll only reaches descendants, so a wrapper the integrator
    // made focusable needs the root handled on its own.
    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.getAttribute('tabindex')).toBe('-1');
    });

    marquee.destroy();
  });

  it('should not use inert, so clones stay operable by pointer', async () => {
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    // inert blocks hit-testing too. The track only translates by one period, so
    // most of what the reader sees at any moment is a clone — inert would leave
    // the majority of a marquee's links dead to the click.
    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.hasAttribute('inert')).toBe(false);
    });

    marquee.destroy();
  });

  it('should hide clones regardless of the motion preference', async () => {
    installMatchMedia(true);
    const { track, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { respectReducedMotion: false });
    await marquee.ready;

    const clones = Array.from(
      track.querySelectorAll<HTMLElement>('[data-marquee-clone]'),
    );

    expect(clones.length).toBeGreaterThan(0);
    clones.forEach((clone) => {
      expect(clone.getAttribute('aria-hidden')).toBe('true');
    });

    marquee.destroy();
  });
});

describe('Marquee - setDirection Axis Guard', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['ltr', 'rtl'],
    ['rtl', 'ltr'],
    ['ttb', 'btt'],
    ['btt', 'ttb'],
  ] as const)(
    'should apply a same-axis change from %s to %s',
    async (from, to) => {
      const { wrapper } = buildFixture();

      const marquee = new Marquee(wrapper, { direction: from });
      await marquee.ready;

      marquee.setDirection(to);

      expect(marquee.getDirection()).toBe(to);
      expect(warn).not.toHaveBeenCalled();

      marquee.destroy();
    },
  );

  it.each([
    ['ltr', 'ttb'],
    ['ltr', 'btt'],
    ['rtl', 'ttb'],
    ['ttb', 'ltr'],
    ['btt', 'rtl'],
  ] as const)(
    'should refuse a cross-axis change from %s to %s',
    async (from, to) => {
      const { wrapper } = buildFixture();

      const marquee = new Marquee(wrapper, { direction: from });
      await marquee.ready;

      marquee.setDirection(to);

      expect(marquee.getDirection()).toBe(from);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain('crosses axes');

      marquee.destroy();
    },
  );

  it('should honor a cross-axis change made before ready resolves', async () => {
    const { track, wrapper } = buildFixture();

    const registered: TickerCallback[] = [];
    const originalAdd = gsap.ticker.add.bind(gsap.ticker);
    vi.spyOn(gsap.ticker, 'add').mockImplementation((callback, ...rest) => {
      registered.push(callback as TickerCallback);
      return originalAdd(callback, ...rest);
    });

    // initialize() measures after two awaits, so nothing is bound to an axis
    // yet and the change is simply read when the measuring happens. Refusing
    // here would break a path that worked, leaving the marquee horizontal
    // against the column layout the caller had already switched to.
    const marquee = new Marquee(wrapper, { dragEase: 0 });
    marquee.setDirection('ttb');
    await marquee.ready;

    registered.at(-1)?.(0, FRAME_DELTA_MS);

    expect(marquee.getDirection()).toBe('ttb');
    expect(gsap.getProperty(track, 'y')).not.toBe(0);
    expect(gsap.getProperty(track, 'x')).toBe(0);
    expect(warn).not.toHaveBeenCalled();

    marquee.destroy();
  });

  it('should keep animating the original axis after a refused change', async () => {
    const { track, wrapper } = buildFixture();

    // The per-frame advance is only reachable through the registration itself.
    const registered: TickerCallback[] = [];
    const originalAdd = gsap.ticker.add.bind(gsap.ticker);
    vi.spyOn(gsap.ticker, 'add').mockImplementation((callback, ...rest) => {
      registered.push(callback as TickerCallback);
      return originalAdd(callback, ...rest);
    });

    // dragEase: 0 makes the quickTo write its target in the same frame, so the
    // transform can be read back without stepping the global timeline.
    const marquee = new Marquee(wrapper, { dragEase: 0 });
    await marquee.ready;

    marquee.setDirection('ttb');

    const advanceFrame = registered.at(-1);
    expect(advanceFrame).toBeDefined();
    advanceFrame?.(0, FRAME_DELTA_MS);

    // The invariant #69 broke: the axis the instance REPORTS is the axis it
    // moves. Asserting x moves is not enough on its own — the pre-fix instance
    // also moved x, it just called itself 'ttb' while doing it.
    const reported = marquee.getDirection();
    const movingAxis = gsap.getProperty(track, 'y') !== 0 ? 'y' : 'x';

    expect(reported).toBe('ltr');
    expect(movingAxis).toBe(reported === 'ltr' ? 'x' : 'y');
    expect(gsap.getProperty(track, 'x')).not.toBe(0);
    expect(gsap.getProperty(track, 'y')).toBe(0);

    marquee.destroy();
  });
});

describe('Marquee - Direction Validation', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  /** Bypasses the compile-time type the way a JS consumer or a DOM attribute does. */
  function setDirectionUnchecked(marquee: Marquee, direction: string): void {
    (marquee as unknown as { setDirection: (d: string) => void }).setDirection(
      direction,
    );
  }

  function createUnchecked(wrapper: HTMLElement, direction: string): Marquee {
    return new Marquee(wrapper, { direction } as unknown as MarqueeOptions);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['TTB', 'vertical', 'up', 'top-to-bottom', '', 'LTR'])(
    'should fall back to ltr when constructed with %o',
    async (bogus) => {
      const { wrapper } = buildFixture();

      const marquee = createUnchecked(wrapper, bogus);
      await marquee.ready;

      expect(marquee.getDirection()).toBe('ltr');
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain('unsupported direction');

      marquee.destroy();
    },
  );

  it.each(['ltr', 'rtl', 'ttb', 'btt'] as const)(
    'should accept %s without warning',
    async (direction) => {
      const { wrapper } = buildFixture();

      const marquee = new Marquee(wrapper, { direction });
      await marquee.ready;

      expect(marquee.getDirection()).toBe(direction);
      expect(warn).not.toHaveBeenCalled();

      marquee.destroy();
    },
  );

  it('should default silently when direction is explicitly undefined', async () => {
    const { wrapper } = buildFixture();

    // `{ direction: maybeUndefined }` is an ordinary way to build options, and
    // the spread merge makes it an explicit undefined — a request for the
    // default, not a typo worth warning about.
    const marquee = new Marquee(wrapper, { direction: undefined });
    await marquee.ready;

    expect(marquee.getDirection()).toBe('ltr');
    expect(warn).not.toHaveBeenCalled();

    marquee.destroy();
  });

  it('should animate the fallback axis, not the bogus one', async () => {
    const { track, wrapper } = buildFixture();

    const registered: TickerCallback[] = [];
    const originalAdd = gsap.ticker.add.bind(gsap.ticker);
    vi.spyOn(gsap.ticker, 'add').mockImplementation((callback, ...rest) => {
      registered.push(callback as TickerCallback);
      return originalAdd(callback, ...rest);
    });

    const marquee = createUnchecked(wrapper, 'TTB');
    await marquee.ready;

    registered.at(-1)?.(0, FRAME_DELTA_MS);

    // 'TTB' looks vertical to a human and is not, so the fallback has to be
    // wholly horizontal — a period measured on width and a transform on x.
    // Reported direction included: storing 'TTB' verbatim while moving x is
    // the state this fallback exists to prevent, and it moves x either way.
    expect(marquee.getDirection()).toBe('ltr');
    expect(gsap.getProperty(track, 'x')).not.toBe(0);
    expect(gsap.getProperty(track, 'y')).toBe(0);

    marquee.destroy();
  });

  it.each(['ltr', 'rtl', 'ttb', 'btt'] as const)(
    'should leave a live %s marquee untouched when setDirection() gets a bogus value',
    async (direction) => {
      const { wrapper } = buildFixture();

      const marquee = new Marquee(wrapper, { direction });
      await marquee.ready;

      // A bogus value reads as horizontal to the axis check, so on a VERTICAL
      // instance the axis guard already rejects it as a cross-axis change. The
      // horizontal cases are the ones that need the type check of their own —
      // without it 'TTB' passes the axis guard and is stored verbatim.
      setDirectionUnchecked(marquee, 'TTB');

      // Defaulting to 'ltr' here — as construction does — would cross a
      // vertical instance onto an axis its layout has no CSS for, which is
      // what the axis guard refuses. A typo is not a request to change axis.
      expect(marquee.getDirection()).toBe(direction);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain('was ignored');

      marquee.destroy();
    },
  );
});
