import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';

import type { MarqueeDirection, MarqueeOptions } from './types.ts';
import {
  clampFrameDelta,
  debounce,
  getTrackGap,
  waitForImages,
  waitForViewport,
} from './utils.ts';

gsap.registerPlugin(Observer);

const DEFAULT_OPTIONS: Required<MarqueeOptions> = {
  speed: 1,
  direction: 'ltr',
  draggable: false,
  dragEase: 0.5,
  pauseOnHover: false,
  respectReducedMotion: true,
};

const RESIZE_DEBOUNCE_MS = 150;

/**
 * Upper bound (ms) for a single ticker frame. Above this we assume the tab was
 * backgrounded or the thread stalled and cap the advance so the marquee never
 * leaps forward when rAF resumes. See {@link clampFrameDelta}.
 */
const MAX_FRAME_DELTA_MS = 100;

/**
 * The media query the reduced-motion freeze is gated on.
 *
 * Deliberately `reduce` rather than the more obvious `no-preference`: on a
 * browser that does not support the feature at all, BOTH queries evaluate
 * false. A `no-preference`-gated ticker would therefore never register and the
 * marquee would sit permanently dead there. Animating by default and gating
 * only the freeze keeps the same intent with a safe fallback.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The overflow value written on the container while reduced motion is active,
 * so the content stays reachable by native scrolling instead of by animation.
 */
const REDUCED_MOTION_OVERFLOW = 'auto';

/**
 * Every direction the library accepts, in one place so {@link isMarqueeDirection}
 * and the warning it feeds can never drift out of step with the type.
 */
const DIRECTIONS: readonly MarqueeDirection[] = ['ltr', 'rtl', 'ttb', 'btt'];

/**
 * Whether a value is one of the four supported directions.
 *
 * `MarqueeDirection` is a compile-time guarantee only, and two paths reach the
 * constructor without one: a plain-JS consumer (the Webflow script embed has no
 * type checking at all), and the `data-marquee-direction` attribute, which
 * `initMarquee` reads as a raw string. A typo in the Designer — `"TTB"`,
 * `"vertical"` — would otherwise be stored verbatim and animate horizontally,
 * with `getDirection()` reporting the typo back.
 */
function isMarqueeDirection(value: unknown): value is MarqueeDirection {
  return DIRECTIONS.includes(value as MarqueeDirection);
}

/**
 * Whether a direction scrolls along the vertical axis.
 *
 * Free of instance state so {@link Marquee.setDirection} can ask the question
 * of an incoming direction, which is the whole point of the axis guard there.
 */
function isVerticalDirection(direction: MarqueeDirection): boolean {
  return direction === 'ttb' || direction === 'btt';
}

/**
 * What would become a tab stop inside a clone. `[tabindex]` catches anything
 * the integrator made focusable by hand, including the wrapper itself.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'audio[controls]',
  'button',
  'details',
  'iframe',
  'input',
  'select',
  'summary',
  'textarea',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',');

/**
 * The container overflow declaration the library replaced while reduced motion is
 * active, captured so it can be put back verbatim.
 */
interface SavedContainerOverflow {
  /** The axis-specific property that was overwritten. */
  property: 'overflowX' | 'overflowY';
  /** The inline value present before the library wrote its own; '' when none was set. */
  previousInlineValue: string;
}

/**
 * Marquee class for creating infinite scrolling animations.
 *
 * Requires a 3-level DOM structure:
 * - Container (grandparent): overflow: hidden, max-width: 100%
 * - Track (parent): display: flex, width: max-content
 * - Wrapper ([data-marquee]): the element passed to constructor, gets cloned
 *
 * The marquee waits for all images to load before calculating dimensions.
 *
 * @example
 * ```typescript
 * // Using the static create method (recommended for images)
 * const marquee = await Marquee.create(element, { speed: 2 });
 *
 * // Or use the ready promise
 * const marquee = new Marquee(element, { speed: 2 });
 * await marquee.ready;
 * ```
 */
export class Marquee {
  public readonly element: HTMLElement;
  public readonly ready: Promise<void>;

  private readonly track: HTMLElement;
  private readonly container: HTMLElement;
  private readonly options: Required<MarqueeOptions>;

  private speed: number;
  private direction: MarqueeDirection;
  private paused: boolean = false;
  private destroyed: boolean = false;
  private initialized: boolean = false;
  private position: number = 0;
  private originalSize: number = 0;
  private clones: HTMLElement[] = [];

  private viewportController: AbortController | null = null;
  private tickerCallback: ((time: number, deltaTime: number) => void) | null =
    null;
  private observer: Observer | null = null;
  private resizeHandler: (() => void) | null = null;
  private boundMouseEnter: (() => void) | null = null;
  private boundMouseLeave: (() => void) | null = null;
  private moveTo: gsap.QuickToFunc | null = null;
  private wrap: ((value: number) => number) | null = null;
  private reducedMotion: boolean = false;
  private reducedMotionMedia: gsap.MatchMedia | null = null;
  private savedOverflow: SavedContainerOverflow | null = null;

  /**
   * Creates a new Marquee instance and waits for images before initializing.
   * Preferred method when the marquee contains images.
   */
  static async create(
    element: HTMLElement,
    options: MarqueeOptions = {},
  ): Promise<Marquee> {
    const instance = new Marquee(element, options);
    await instance.ready;
    return instance;
  }

  constructor(element: HTMLElement, options: MarqueeOptions = {}) {
    this.element = element;

    const merged = { ...DEFAULT_OPTIONS, ...options };
    // Sanitized into `options` rather than just `direction` so there is one
    // truth: an unsupported value must not survive anywhere on the instance.
    this.options = {
      ...merged,
      direction: this.resolveDirection(merged.direction),
    };
    this.speed = this.options.speed;
    this.direction = this.options.direction;

    this.track = this.getTrackElement();
    this.container = this.getContainerElement();

    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    // Wait until the container is visible in the viewport before loading images.
    // This preserves lazy-loading for below-fold marquees while ensuring images
    // load before we measure dimensions.
    this.viewportController = new AbortController();
    await waitForViewport(this.container, this.viewportController.signal);
    this.viewportController = null;

    if (this.destroyed) return;

    // Force any lazy images that haven't loaded yet to load eagerly.
    // At this point the marquee is in the viewport, so bandwidth is justified.
    this.element.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (!img.complete && img.loading === 'lazy') {
        img.loading = 'eager';
      }
    });

    await waitForImages(this.element);

    if (this.destroyed) return;

    // Mark element as initialized to prevent double-initialization
    this.element.setAttribute('data-marquee-initialized', 'true');

    this.originalSize = this.measurePeriod();

    // Warned once here rather than in updateClones(), which also runs on every
    // resize. A marquee that measures 0 is a misconfiguration the integrator
    // can act on — an empty wrapper, or children that contribute no layout.
    if (!this.originalSize) {
      console.warn(
        'Marquee: wrapper measured 0, so nothing will animate. Check that it ' +
          'has laid-out content.',
        this.element,
      );
    }

    this.wrap = gsap.utils.wrap(-this.originalSize, 0);
    this.installQuickTo();

    this.updateClones();
    // Owns starting motion (ticker + drag Observer) and, when the preference is
    // honored, the freeze/unfreeze lifecycle around it.
    this.setupReducedMotionGate();
    this.setupHoverPause();
    this.setupResizeHandler();

    this.initialized = true;
  }

  /**
   * Falls back to the documented `ltr` default when the configured direction is
   * not one the library supports, warning so the typo is findable.
   *
   * Construction is the one place a bad value CAN be defaulted: nothing is
   * bound to an axis yet, so landing on `ltr` is the same as never having been
   * given anything. {@link setDirection} deliberately does not do this — see
   * the note there.
   */
  private resolveDirection(direction: MarqueeDirection): MarqueeDirection {
    if (isMarqueeDirection(direction)) return direction;

    // `{ direction: undefined }` is legal for an optional property, and the
    // spread merge turns it into an explicit undefined rather than dropping it.
    // That is a caller asking for the default, not a typo, so it defaults
    // silently — warning there would fire on `{ direction: maybeUndefined }`.
    if (direction === undefined || direction === null) {
      return DEFAULT_OPTIONS.direction;
    }

    console.warn(
      `Marquee: unsupported direction ${JSON.stringify(direction)}. ` +
        `Expected one of ${DIRECTIONS.join(', ')} — falling back to ` +
        `'${DEFAULT_OPTIONS.direction}'.`,
      this.element,
    );

    return DEFAULT_OPTIONS.direction;
  }

  private getTrackElement(): HTMLElement {
    const track = this.element.parentElement;
    if (!track) {
      throw new Error('Marquee wrapper must have a parent element (track)');
    }
    return track;
  }

  private getContainerElement(): HTMLElement {
    const container = this.track.parentElement;
    if (!container) {
      throw new Error('Marquee track must have a parent element (container)');
    }
    return container;
  }

  private isVertical(): boolean {
    return isVerticalDirection(this.direction);
  }

  /**
   * The seamless loop distance: the wrapper's own size PLUS the flex gap the
   * track puts between it and the next clone. Measured with
   * getBoundingClientRect (fractional) instead of offsetWidth/offsetHeight
   * (integer-rounded) so sub-pixel widths don't accumulate drift on every loop.
   * Omitting the gap makes the content jump by one gap-width at each wrap.
   */
  private measurePeriod(): number {
    const rect = this.element.getBoundingClientRect();
    const base = this.isVertical() ? rect.height : rect.width;
    return base + getTrackGap(this.track, this.isVertical());
  }

  /**
   * Installs a fresh quickTo for the current axis, standing down the tween the
   * previous one left in flight.
   *
   * A quickTo tween outlives its last call by up to `dragEase` seconds. Drop
   * the reference without killing it and it keeps writing the axis off the
   * books: {@link resetPosition} can only reach the tween behind the CURRENT
   * `moveTo`, so an orphan wins over the `gsap.set` on every frame it has left.
   *
   * Killing is safe here — unlike the freeze, the function itself is discarded.
   *
   * @returns the installed function, so callers keep it non-null without a cast.
   */
  private installQuickTo(): gsap.QuickToFunc {
    this.moveTo?.tween.kill();
    this.moveTo = this.createQuickTo();
    return this.moveTo;
  }

  private createQuickTo(): gsap.QuickToFunc {
    const axis = this.isVertical() ? 'y' : 'x';
    const modifiers: Record<string, (value: number) => string> = {
      [axis]: gsap.utils.unitize(this.wrap!),
    };
    return gsap.quickTo(this.track, axis, {
      duration: this.options.dragEase,
      ease: 'power3',
      modifiers,
    });
  }

  /**
   * Calculates and manages clones to fill 2x container width for seamless looping
   */
  private updateClones(): void {
    // A wrapper that measures 0 makes `clonesNeeded` Infinity when the
    // container has a size, and the append loop below then runs until the tab
    // dies. (With a zero-sized container it is NaN instead, and the loop simply
    // never runs — which is why jsdom's all-zero default never surfaced this.)
    // `!0` and `!NaN` are both true, so one condition covers both. A later
    // resize re-measures and recovers.
    if (!this.originalSize) return;

    const containerSize = this.isVertical()
      ? this.container.clientHeight
      : this.container.clientWidth;
    const wrappersNeeded = Math.max(
      2,
      Math.ceil((containerSize * 2) / this.originalSize) + 1,
    );
    const clonesNeeded = wrappersNeeded - 1;

    while (this.clones.length < clonesNeeded) {
      const clone = this.element.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-marquee-clone', 'true');
      clone.removeAttribute('id');
      this.markDecorative(clone);
      this.track.appendChild(clone);
      this.clones.push(clone);
    }

    while (this.clones.length > clonesNeeded) {
      const clone = this.clones.pop();
      clone?.remove();
    }
  }

  /**
   * Excludes a clone from the accessibility tree AND the tab order, while
   * leaving it operable by pointer.
   *
   * Clones duplicate whatever the wrapper holds, so without this every cloned
   * link becomes a repeated announcement and a ghost tab stop. `inert` covers
   * both in one attribute — and was the first choice here — but it also blocks
   * hit-testing. The track only ever translates by one period, so the original
   * wrapper contributes at most `originalSize` pixels of a `containerSize`-wide
   * window and most of what the reader sees at any moment is a clone. `inert`
   * therefore leaves the majority of a marquee's links dead to the click, which
   * reads as a broken site rather than a library limitation.
   *
   * `aria-hidden` plus `tabindex="-1"` draws the line where we want it, and
   * unlike `inert` it needs no modern-browser support to apply at all.
   *
   * The residual: a pointer can still move focus into an `aria-hidden` subtree,
   * so axe reports `aria-hidden-focus` as needs-review rather than a clean
   * pass. Narrow next to silently breaking every visible link.
   */
  private markDecorative(clone: HTMLElement): void {
    clone.setAttribute('aria-hidden', 'true');

    // querySelectorAll only reaches descendants, so a wrapper the integrator
    // made focusable has to be handled on its own.
    if (clone.matches(FOCUSABLE_SELECTOR)) {
      clone.setAttribute('tabindex', '-1');
    }

    clone
      .querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      .forEach((node) => node.setAttribute('tabindex', '-1'));
  }

  /** Builds the per-frame advance function. Registration is {@link startMotion}'s job. */
  private createTickerCallback(): (time: number, deltaTime: number) => void {
    return (_time: number, deltaTime: number) => {
      if (this.paused || this.destroyed || !this.moveTo) return;

      const directionMultiplier =
        this.direction === 'rtl' || this.direction === 'ttb' ? -1 : 1;
      const delta = clampFrameDelta(deltaTime, MAX_FRAME_DELTA_MS);
      this.position -= (delta / 15) * this.speed * directionMultiplier;
      this.moveTo(this.position);
    };
  }

  /**
   * Puts the marquee in motion: registers the ticker and creates the drag
   * Observer. Idempotent — a live `tickerCallback` means motion is already on.
   */
  private startMotion(): void {
    if (this.destroyed) return;

    if (!this.tickerCallback) {
      this.tickerCallback = this.createTickerCallback();
      gsap.ticker.add(this.tickerCallback);
    }

    this.setupDragInteraction();
  }

  /** Takes the marquee out of motion: deregisters the ticker, kills the drag Observer. */
  private stopMotion(): void {
    if (this.tickerCallback) {
      gsap.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }

    if (this.observer) {
      this.observer.kill();
      this.observer = null;
    }
  }

  private setupDragInteraction(): void {
    if (!this.options.draggable || this.observer) return;

    const vertical = this.isVertical();
    this.observer = Observer.create({
      target: this.track,
      type: 'pointer,touch',
      onDrag: (self) => {
        if (!this.moveTo) return;
        this.position += vertical ? self.deltaY : self.deltaX;
        this.moveTo(this.position);
      },
    });
  }

  /**
   * Starts motion, then — when the preference is honored and the browser can
   * report it — wires {@link REDUCED_MOTION_QUERY} to the freeze/unfreeze pair.
   *
   * If the query already matches, GSAP runs the body synchronously here, so the
   * ticker and Observer created above are torn down within the same tick. That
   * micro-churn is the price of a structure that is safe on browsers which
   * cannot report the preference at all.
   */
  private setupReducedMotionGate(): void {
    this.startMotion();

    if (
      !this.options.respectReducedMotion ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    this.reducedMotionMedia = gsap.matchMedia();
    this.reducedMotionMedia.add(REDUCED_MOTION_QUERY, (context) => {
      // ignore() keeps the freeze's gsap.set out of the context's revert list.
      // Recorded, it would be undone on exit — putting the track back at its
      // pre-freeze offset just as motion resumes from position 0.
      context.ignore(() => this.enterReducedMotion());
      return () => this.exitReducedMotion();
    });
  }

  /** Freezes the marquee at its start position and makes the container scrollable. */
  private enterReducedMotion(): void {
    this.reducedMotion = true;
    this.stopMotion();
    this.resetPosition();
    this.applyScrollOverflow();
  }

  /** Undoes {@link enterReducedMotion} and puts the marquee back in motion. */
  private exitReducedMotion(): void {
    this.reducedMotion = false;
    // Zeroed before the overflow goes back: `overflow: hidden` preserves the
    // scroll offset, so a marquee left displaced by the user would otherwise
    // animate from that offset with no way to scroll back.
    this.resetContainerScroll();
    this.restoreContainerOverflow();
    this.startMotion();
  }

  /**
   * Puts the track back at offset 0 and retires the tween that was carrying it.
   *
   * The ticker hands `moveTo` a new target every frame, so at any moment there
   * is a quickTo tween in flight with up to `dragEase` seconds left to run. The
   * `gsap.set` below lands, and then that tween keeps applying values over the
   * following frames — dragging the track back to its pre-freeze offset. So the
   * tween has to be stood down, and `invalidate()` has to come after the set so
   * the tween re-reads 0 as its start value rather than the offset it recorded.
   *
   * Pausing rather than killing is deliberate: killing the tween behind a
   * quickTo leaves that function permanently inert, and {@link exitReducedMotion}
   * resumes motion through the very same `moveTo`.
   */
  private resetPosition(): void {
    this.position = 0;
    this.moveTo?.tween.pause();
    gsap.set(this.track, this.isVertical() ? { y: 0 } : { x: 0 });
    this.moveTo?.tween.invalidate();
  }

  /**
   * Writes the scroll overflow for the active axis, recording whatever inline
   * value it replaced. This is the only style the library ever writes on the
   * container, an element the integrator owns — hence the save/restore pair.
   */
  private applyScrollOverflow(): void {
    const property: SavedContainerOverflow['property'] = this.isVertical()
      ? 'overflowY'
      : 'overflowX';

    this.savedOverflow = {
      property,
      previousInlineValue: this.container.style[property],
    };
    this.container.style[property] = REDUCED_MOTION_OVERFLOW;
  }

  /** Puts the recorded inline overflow back verbatim; '' clears the declaration. */
  private restoreContainerOverflow(): void {
    if (!this.savedOverflow) return;

    const { property, previousInlineValue } = this.savedOverflow;
    this.container.style[property] = previousInlineValue;
    this.savedOverflow = null;
  }

  /**
   * Zeroes the offset on the axis the library made scrollable — and only that
   * one. A container the library never wrote to is left alone entirely: any
   * offset it holds came from the page (`scrollIntoView()`, focus), not from us.
   */
  private resetContainerScroll(): void {
    if (!this.savedOverflow) return;

    if (this.savedOverflow.property === 'overflowY') {
      this.container.scrollTop = 0;
      return;
    }

    this.container.scrollLeft = 0;
  }

  private setupHoverPause(): void {
    if (!this.options.pauseOnHover) return;

    this.boundMouseEnter = () => this.pause();
    this.boundMouseLeave = () => this.resume();

    this.container.addEventListener('mouseenter', this.boundMouseEnter);
    this.container.addEventListener('mouseleave', this.boundMouseLeave);
  }

  private setupResizeHandler(): void {
    this.resizeHandler = debounce(
      () => this.handleResize(),
      RESIZE_DEBOUNCE_MS,
    );
    window.addEventListener('resize', this.resizeHandler);
  }

  private handleResize(): void {
    if (this.destroyed || !this.initialized) return;

    this.originalSize = this.measurePeriod();
    this.updateClones();

    this.wrap = gsap.utils.wrap(-this.originalSize, 0);
    const moveTo = this.installQuickTo();

    if (this.reducedMotion) {
      // `gsap.utils.wrap(-N, 0)(0)` returns -N because the max is exclusive, and
      // moveTo carries that same wrap as a modifier. Either path would displace a
      // marquee that is supposed to stay frozen, so write the transform directly.
      this.resetPosition();
      return;
    }

    this.position = this.wrap(this.position);
    moveTo(this.position);
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  /**
   * True when the marquee is not advancing — whether because {@link pause} was
   * called or because reduced motion has frozen it. Under reduced motion
   * {@link resume} flips the internal flag but nothing moves, so reporting
   * `false` there would be a lie.
   */
  public isPaused(): boolean {
    return this.paused || this.reducedMotion;
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
  }

  public getSpeed(): number {
    return this.speed;
  }

  /**
   * Updates the scroll direction — within the current axis only.
   *
   * A same-axis flip (`ltr` ↔ `rtl`, `ttb` ↔ `btt`) is a one-line state
   * change, because the only thing reading the direction per frame is the sign
   * in {@link createTickerCallback}. A cross-axis change is REJECTED: it warns
   * and leaves the instance untouched.
   *
   * Refusing beats reassigning, which is all this used to do. Everything that
   * drives the animation is bound to the axis the instance was built on —
   * `moveTo` writes a fixed `x` or `y` ({@link createQuickTo}), `originalSize`
   * measures one dimension ({@link measurePeriod}), `wrap` derives from it, and
   * the clone count reads the matching container dimension
   * ({@link updateClones}). Reassigning alone left the instance reporting the
   * new direction while still animating the old axis, with a period and a clone
   * count computed for it — until the next window resize rebuilt all four and
   * hid the inconsistency, which is what made it look intermittent (#69).
   *
   * Rebuilding those four here would not be enough either: a vertical marquee
   * also needs `flex-direction: column` plus `height: max-content` on the track
   * and wrapper. Those live in the integrator's stylesheet, the library never
   * writes them, and a class swap fires no event this instance can observe. So
   * crossing axes is a `destroy()` and a fresh instance, not a setter.
   */
  public setDirection(direction: MarqueeDirection): void {
    // NOT defaulted to 'ltr' the way construction does. A live vertical marquee
    // handed a typo would then be silently switched to a horizontal axis it has
    // no layout for — the very failure the axis guard below exists to prevent.
    // Leaving the direction untouched is the conservative read of a typo.
    if (!isMarqueeDirection(direction)) {
      console.warn(
        `Marquee: setDirection(${JSON.stringify(direction)}) is not one of ` +
          `${DIRECTIONS.join(', ')} and was ignored. The direction is still ` +
          `'${this.direction}'.`,
        this.element,
      );
      return;
    }

    if (isVerticalDirection(direction) !== this.isVertical()) {
      console.warn(
        `Marquee: setDirection('${direction}') crosses axes from ` +
          `'${this.direction}' and was ignored. Horizontal and vertical ` +
          'marquees need different track CSS, so switching axes means ' +
          'destroy() and a new instance.',
        this.element,
      );
      return;
    }

    this.direction = direction;
  }

  public getDirection(): MarqueeDirection {
    return this.direction;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Cleans up all event listeners, clones, and resets transforms
   */
  public destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    this.viewportController?.abort();
    this.viewportController = null;

    // Remove initialization marker
    this.element.removeAttribute('data-marquee-initialized');

    this.stopMotion();

    // kill(true) reverts the contexts, which runs exitReducedMotion. It returns
    // early on the startMotion call because `destroyed` is already true, so this
    // restores the container without resurrecting the ticker.
    this.reducedMotionMedia?.kill(true);
    this.reducedMotionMedia = null;
    this.reducedMotion = false;

    // Belt and braces for a context that was registered but never reverted.
    // Both are guarded on the recorded overflow, so they no-op once the cleanup
    // above has run — and on the paths that never froze the container is left
    // exactly as the integrator had it, never read and never written.
    this.resetContainerScroll();
    this.restoreContainerOverflow();

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.boundMouseEnter) {
      this.container.removeEventListener('mouseenter', this.boundMouseEnter);
      this.boundMouseEnter = null;
    }
    if (this.boundMouseLeave) {
      this.container.removeEventListener('mouseleave', this.boundMouseLeave);
      this.boundMouseLeave = null;
    }

    this.clones.forEach((clone) => clone.remove());
    this.clones = [];

    // The tween the ticker's last frame started is still in flight with up to
    // `dragEase` seconds to run, and would write the axis over the reset below.
    // Killing rather than pausing is right here: unlike the freeze, nothing
    // resumes motion through this `moveTo` afterwards.
    this.moveTo?.tween.kill();
    this.moveTo = null;

    gsap.set(this.track, this.isVertical() ? { y: 0 } : { x: 0 });
  }
}
