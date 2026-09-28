import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';
import { Marquee } from '../Marquee.ts';
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
  /** The pause button, a sibling of the track as the README requires. */
  pauseButton: HTMLButtonElement;
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
 *
 * The pause button is part of the baseline markup: it is what the library asks
 * for, and leaving it out would have every fixture-based test trip the
 * missing-button warning.
 */
function buildFixture(): MarqueeFixture {
  document.body.innerHTML = `
    <div class="container">
      <div class="track">
        <div class="wrapper" data-marquee>
          <a href="#one" data-marquee-item>One</a>
        </div>
      </div>
      <button type="button" data-marquee-pause-button>Pause</button>
    </div>
  `;

  const container = document.querySelector<HTMLElement>('.container')!;
  const track = document.querySelector<HTMLElement>('.track')!;
  const wrapper = document.querySelector<HTMLElement>('.wrapper')!;
  const pauseButton = document.querySelector<HTMLButtonElement>(
    '[data-marquee-pause-button]',
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

  return { container, track, wrapper, pauseButton };
}

/**
 * Ticker registrations recorded in call order. Populated by
 * {@link installTickerLog}, which every suite that needs it installs in its own
 * `beforeEach`.
 */
let tickerLog: { type: 'add' | 'remove'; callback: unknown }[] = [];

/**
 * Records every `gsap.ticker` registration for the duration of one test.
 *
 * Whether the marquee is advancing is only observable through ticker
 * registration and the transform a frame writes — asserting real motion is not
 * feasible without a browser. This is the one white-box seam in the suite.
 */
function installTickerLog(): void {
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
}

/**
 * The ticker callbacks still registered.
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

/** Runs one marquee frame by hand, since jsdom never runs the real ticker. */
function advanceOneFrame(): void {
  const [advanceFrame] = liveTickerCallbacks() as TickerCallback[];
  advanceFrame(0, FRAME_DELTA_MS);
}

/** Comfortably past the default `dragEase` of 0.5s. */
const TWEEN_SETTLE_SECONDS = 1;

/**
 * Whether a hand-run frame actually moves the track.
 *
 * The paused check has to be behavioural rather than a read of `isPaused()`:
 * the whole point of separating explicit from transient pausing is what the
 * TICKER does, and a getter could agree with itself while the marquee kept
 * sliding.
 *
 * Both reads are taken with the timeline stepped past the tween's duration.
 * The ticker hands `moveTo` a target rather than writing the transform, and
 * jsdom never advances the global timeline on its own — so a marquee that is
 * very much moving renders nothing between two bare reads.
 */
function frameMovesTrack(track: HTMLElement): boolean {
  advanceGlobalTimeline(TWEEN_SETTLE_SECONDS);
  const before = Number(gsap.getProperty(track, 'x'));

  advanceOneFrame();
  advanceGlobalTimeline(TWEEN_SETTLE_SECONDS);

  return Number(gsap.getProperty(track, 'x')) !== before;
}

/** Dispatches the bubbling event the marquee listens for, from `target`. */
function dispatchFrom(target: HTMLElement, type: string): void {
  target.dispatchEvent(new Event(type, { bubbles: true }));
}

/**
 * A bubbling `focusout` carrying `relatedTarget` — where focus is going.
 *
 * jsdom does not populate `relatedTarget` from real focus moves, and the
 * marquee reads it to tell a hop between two descendants apart from focus
 * actually leaving the container.
 */
function dispatchFocusOut(
  target: HTMLElement,
  relatedTarget: HTMLElement | null,
): void {
  target.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget }),
  );
}

describe('Marquee - Reduced Motion', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    installTickerLog();
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

  it('should move the overflow to the new axis when setDirection() flips it', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(container.style.overflowX).toBe('auto');

    marquee.setDirection('ttb');

    expect(container.style.overflowX).toBe('');
    expect(container.style.overflowY).toBe('auto');

    marquee.destroy();
  });

  it('should reset the abandoned axis scroll offset when setDirection() flips it', async () => {
    installMatchMedia(true);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    // The user scrolled the frozen marquee along the horizontal axis.
    container.scrollLeft = 250;

    marquee.setDirection('ttb');

    // Restoring the horizontal overflow hands that axis back to the stylesheet's
    // `overflow: hidden`, which PRESERVES the offset — so leaving it would strand
    // the content 250px off-screen with no scrollbar left to bring it back.
    expect(container.scrollLeft).toBe(0);
    expect(container.style.overflowY).toBe('auto');

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

describe('Marquee - Pause Button', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    installTickerLog();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should stop the marquee on the first press and start it again on the second', async () => {
    installMatchMedia(false);
    const { track, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;
    expect(frameMovesTrack(track)).toBe(true);

    pauseButton.click();

    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    pauseButton.click();

    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should mirror the paused state onto the button', async () => {
    installMatchMedia(false);
    const { pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;

    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('false');

    pauseButton.click();
    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('true');

    // The API and the button drive the same state, so the control has to follow
    // a programmatic resume too.
    marquee.resume();
    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('false');

    marquee.destroy();
  });

  it('should mirror a hover pause too, so the label cannot claim it is moving', async () => {
    installMatchMedia(false);
    const { container, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    dispatchFrom(container, 'mouseenter');

    // The attribute drives the integrator's label. A marquee sitting still
    // under a hover pause with the control still reading "Pause" would be the
    // label lying about the marquee.
    expect(marquee.isPaused()).toBe(true);
    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('true');

    dispatchFrom(container, 'mouseleave');

    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('false');

    marquee.destroy();
  });

  it('should bind every button in the container and keep them in sync', async () => {
    installMatchMedia(false);
    const { container, track } = buildFixture();

    const second = document.createElement('button');
    second.setAttribute('data-marquee-pause-button', '');
    container.appendChild(second);

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;

    const [first] = container.querySelectorAll<HTMLButtonElement>(
      '[data-marquee-pause-button]',
    );

    second.click();

    expect(frameMovesTrack(track)).toBe(false);
    expect(first!.getAttribute('data-marquee-paused')).toBe('true');
    expect(second.getAttribute('data-marquee-paused')).toBe('true');

    marquee.destroy();
  });

  it('should resolve the selector against its own container, not the document', async () => {
    installMatchMedia(false);
    document.body.innerHTML = `
      <div class="container-a">
        <div class="track-a"><div class="wrapper-a" data-marquee></div></div>
      </div>
      <div class="container-b">
        <div class="track-b"><div class="wrapper-b" data-marquee></div></div>
        <button type="button" data-marquee-pause-button>Pause B</button>
      </div>
    `;

    const wrapperA = document.querySelector<HTMLElement>('.wrapper-a')!;
    const wrapperB = document.querySelector<HTMLElement>('.wrapper-b')!;
    const buttonB = document.querySelector<HTMLButtonElement>(
      '[data-marquee-pause-button]',
    )!;

    const marqueeA = new Marquee(wrapperA);
    const marqueeB = new Marquee(wrapperB);
    await Promise.all([marqueeA.ready, marqueeB.ready]);

    buttonB.click();

    expect(marqueeB.isPaused()).toBe(true);
    expect(marqueeA.isPaused()).toBe(false);

    marqueeA.destroy();
    marqueeB.destroy();
  });

  it('should refuse a button inside the wrapper, where cloning would duplicate it', async () => {
    installMatchMedia(false);
    const { track, wrapper } = buildFixture();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const inside = document.createElement('button');
    inside.setAttribute('data-marquee-pause-button', '');
    wrapper.appendChild(inside);

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    inside.click();

    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('inside the track'),
      expect.anything(),
    );

    marquee.destroy();
  });

  it('should warn when nothing matches the selector', async () => {
    installMatchMedia(false);
    const { wrapper } = buildFixture();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('no pause button matching'),
      expect.anything(),
    );

    marquee.destroy();
  });

  it('should neither bind nor warn when pauseButton is false', async () => {
    installMatchMedia(false);
    const { track, wrapper, pauseButton } = buildFixture();

    const marquee = new Marquee(wrapper, { pauseButton: false });
    await marquee.ready;

    pauseButton.click();

    expect(frameMovesTrack(track)).toBe(true);
    expect(pauseButton.hasAttribute('data-marquee-paused')).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();

    marquee.destroy();
  });

  it('should honor a custom pauseButtonSelector', async () => {
    installMatchMedia(false);
    const { container, track, wrapper } = buildFixture();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const custom = document.createElement('button');
    custom.className = 'stop';
    container.appendChild(custom);

    const marquee = new Marquee(wrapper, { pauseButtonSelector: '.stop' });
    await marquee.ready;

    custom.click();

    expect(frameMovesTrack(track)).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();

    marquee.destroy();
  });

  it('should hide the button while reduced motion is applied', async () => {
    const media = installMatchMedia(false);
    const { pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;
    expect(pauseButton.style.display).toBe('');

    await media.flip(true);

    expect(pauseButton.style.display).toBe('none');

    marquee.destroy();
  });

  it('should hide the button when reduced motion is already active at init', async () => {
    installMatchMedia(true);
    const { pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;

    expect(pauseButton.style.display).toBe('none');

    marquee.destroy();
  });

  it('should keep the button when the preference is not honored', async () => {
    installMatchMedia(true);
    const { pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      respectReducedMotion: false,
    });
    await marquee.ready;

    // The marquee is moving, so the button is the only mechanism there is.
    expect(pauseButton.style.display).toBe('');

    marquee.destroy();
  });

  it('should restore an inline display the integrator had already set', async () => {
    const media = installMatchMedia(false);
    const { pauseButton } = buildFixture();
    pauseButton.style.display = 'inline-flex';

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;

    await media.flip(true);
    expect(pauseButton.style.display).toBe('none');

    await media.flip(false);

    expect(pauseButton.style.display).toBe('inline-flex');

    marquee.destroy();
  });

  it('should clear the display declaration when none was set inline', async () => {
    const media = installMatchMedia(true);
    const { pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;
    expect(pauseButton.style.display).toBe('none');

    await media.flip(false);

    expect(pauseButton.getAttribute('style')).toBe('');

    marquee.destroy();
  });

  it('should hand the button back untouched on destroy', async () => {
    installMatchMedia(true);
    const { track, wrapper, pauseButton } = buildFixture();

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(pauseButton.style.display).toBe('none');

    marquee.destroy();

    expect(pauseButton.getAttribute('style')).toBe('');
    expect(pauseButton.hasAttribute('data-marquee-paused')).toBe(false);

    // The listener is off: a click after destroy touches nothing.
    pauseButton.click();
    expect(Number(gsap.getProperty(track, 'x'))).toBe(0);
  });

  it('should restore a state attribute the integrator had set on destroy', async () => {
    installMatchMedia(false);
    const { wrapper, pauseButton } = buildFixture();
    pauseButton.setAttribute('data-marquee-paused', 'whatever');

    const marquee = new Marquee(wrapper);
    await marquee.ready;
    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('false');

    marquee.destroy();

    expect(pauseButton.getAttribute('data-marquee-paused')).toBe('whatever');
  });

  it('should survive an invalid pauseButtonSelector without losing the marquee', async () => {
    installMatchMedia(false);
    const { track, wrapper } = buildFixture();

    // querySelectorAll throws on this. Unguarded, the throw would reject
    // ready(), skip the reduced-motion gate and the resize handler, and leave
    // data-marquee-initialized behind so a later initMarquee() skips the
    // element — a typo in an optional accessory taking out the core feature.
    const marquee = new Marquee(wrapper, {
      pauseButtonSelector: 'button:pause',
    });
    await marquee.ready;

    expect(marquee.isReady()).toBe(true);
    expect(frameMovesTrack(track)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('not a valid CSS selector'),
      expect.anything(),
    );

    marquee.destroy();
  });

  it('should warn when the pause control is not keyboard operable', async () => {
    installMatchMedia(false);
    const { container, track, wrapper } = buildFixture();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const div = document.createElement('div');
    div.setAttribute('data-marquee-pause-button', '');
    container.appendChild(div);

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('neither a <button> nor role="button"'),
      div,
    );

    // Bound anyway — a click listener on a div still works for pointer users,
    // and the element is the integrator's call.
    div.click();
    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should not warn about a role="button" control', async () => {
    installMatchMedia(false);
    const { container, wrapper } = buildFixture();
    document.querySelector('[data-marquee-pause-button]')!.remove();

    const span = document.createElement('span');
    span.setAttribute('data-marquee-pause-button', '');
    span.setAttribute('role', 'button');
    span.tabIndex = 0;
    container.appendChild(span);

    const marquee = new Marquee(wrapper);
    await marquee.ready;

    expect(console.warn).not.toHaveBeenCalled();

    marquee.destroy();
  });
});

describe('Marquee - Explicit vs Transient Pause', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    installTickerLog();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should not let mouseleave resume a marquee the button paused', async () => {
    installMatchMedia(false);
    const { container, track, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    pauseButton.click();
    dispatchFrom(container, 'mouseenter');
    dispatchFrom(container, 'mouseleave');

    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should not let mouseleave resume a marquee pause() stopped', async () => {
    installMatchMedia(false);
    const { container, track } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    marquee.pause();
    dispatchFrom(container, 'mouseleave');

    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should pause while focus is inside and resume when it leaves', async () => {
    installMatchMedia(false);
    const { track } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnFocus: true,
    });
    await marquee.ready;

    dispatchFrom(link, 'focusin');

    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    dispatchFocusOut(link, null);

    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should stay paused when focus moves from a link to the pause button', async () => {
    installMatchMedia(false);
    const { track, pauseButton } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnFocus: true,
    });
    await marquee.ready;

    dispatchFrom(link, 'focusin');
    expect(frameMovesTrack(track)).toBe(false);

    // Tabbing onward to the pause control. focusout fires on the link with the
    // button as relatedTarget — both are inside the container, so focus never
    // actually left and the marquee must not restart under the reader's hands
    // at the exact moment they reach for the control.
    dispatchFocusOut(link, pauseButton);
    dispatchFrom(pauseButton, 'focusin');

    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    // And the first press does the thing the label promises: the marquee is
    // stopped, so pressing it runs.
    pauseButton.click();
    expect(frameMovesTrack(track)).toBe(true);

    pauseButton.click();
    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should resume once focus actually leaves the container', async () => {
    installMatchMedia(false);
    const { track, container } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const outside = document.createElement('a');
    outside.href = '#away';
    document.body.appendChild(outside);

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnFocus: true,
    });
    await marquee.ready;

    dispatchFrom(link, 'focusin');
    expect(frameMovesTrack(track)).toBe(false);

    dispatchFocusOut(link, outside);

    expect(container.contains(outside)).toBe(false);
    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should treat a focusout with no relatedTarget as focus leaving', async () => {
    installMatchMedia(false);
    const { track } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnFocus: true,
    });
    await marquee.ready;

    dispatchFrom(link, 'focusin');
    expect(frameMovesTrack(track)).toBe(false);

    // Clicking away to nothing focusable, or tabbing out of the document
    // entirely, leaves relatedTarget null.
    dispatchFocusOut(link, null);

    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should not let focusout resume a marquee the button paused', async () => {
    installMatchMedia(false);
    const { track, pauseButton } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnFocus: true,
    });
    await marquee.ready;

    pauseButton.click();
    dispatchFrom(link, 'focusin');
    dispatchFocusOut(link, null);

    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should run while the pointer rests on the marquee after an explicit resume', async () => {
    installMatchMedia(false);
    const { container, track, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    dispatchFrom(container, 'mouseenter');
    expect(frameMovesTrack(track)).toBe(false);

    // The button is inside the container, so reaching it means hovering the
    // marquee. If the press only cleared a press-history flag, the hover pause
    // would immediately re-assert and the control would be permanently dead
    // under pauseOnHover.
    pauseButton.click();

    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should let hover pause again once the pointer has left and come back', async () => {
    installMatchMedia(false);
    const { container, track, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    dispatchFrom(container, 'mouseenter');
    pauseButton.click();
    expect(frameMovesTrack(track)).toBe(true);

    // The override retires with the gesture it overrode, rather than disabling
    // pauseOnHover for the rest of the page's life.
    dispatchFrom(container, 'mouseleave');
    dispatchFrom(container, 'mouseenter');

    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should keep an explicit pause across a pointer leave and re-entry', async () => {
    installMatchMedia(false);
    const { container, track, pauseButton } = buildFixture();

    const marquee = new Marquee(document.querySelector('.wrapper')!, {
      pauseOnHover: true,
    });
    await marquee.ready;

    pauseButton.click();

    dispatchFrom(container, 'mouseenter');
    dispatchFrom(container, 'mouseleave');

    // Only 'running' expires on leave. A deliberate pause outliving these
    // gestures is the whole of WCAG 2.2.2.
    expect(marquee.isPaused()).toBe(true);
    expect(frameMovesTrack(track)).toBe(false);

    marquee.destroy();
  });

  it('should ignore focus entirely when pauseOnFocus is off', async () => {
    installMatchMedia(false);
    const { track } = buildFixture();
    const link = document.querySelector<HTMLElement>('.wrapper a')!;

    const marquee = new Marquee(document.querySelector('.wrapper')!);
    await marquee.ready;

    dispatchFrom(link, 'focusin');

    expect(marquee.isPaused()).toBe(false);
    expect(frameMovesTrack(track)).toBe(true);

    marquee.destroy();
  });

  it('should take the focus listeners back off on destroy', async () => {
    installMatchMedia(false);
    const { container, wrapper } = buildFixture();

    const marquee = new Marquee(wrapper, { pauseOnFocus: true });
    await marquee.ready;

    const removed = vi.spyOn(container, 'removeEventListener');
    marquee.destroy();

    const types = removed.mock.calls.map(([type]) => type);
    expect(types).toContain('focusin');
    expect(types).toContain('focusout');
  });
});
