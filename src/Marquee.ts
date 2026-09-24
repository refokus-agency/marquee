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
  pauseOnFocus: false,
  pauseButton: true,
  pauseButtonSelector: '[data-marquee-pause-button]',
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
 * The attribute mirroring the marquee's paused state onto every bound pause
 * button, for the integrator to key their label and styling off.
 *
 * Deliberately a data attribute rather than `aria-pressed`. `aria-pressed` is
 * only valid on something with button semantics, and the selector can match any
 * element — so writing it would risk introducing an `aria-allowed-attr`
 * violation into the integrator's page, from an accessibility feature. It would
 * also double-signal against the label swap this attribute exists to drive: a
 * button whose text already reads "Play" does not also need to announce
 * "pressed".
 */
const PAUSED_STATE_ATTRIBUTE = 'data-marquee-paused';

/** What counts as operable by keyboard, for the pause button warning. */
const BUTTON_SEMANTICS_SELECTOR = 'button,[role="button"]';

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
 * The reader's standing decision about motion, or `null` when they have not
 * made one and hover/focus pausing is free to apply.
 *
 * A plain boolean cannot express this. WCAG 2.2.2 needs `'paused'` to outrank
 * hover and focus — a mechanism another gesture can silently undo is not one —
 * but `'running'` has to outrank them too, or pressing "play" on a marquee that
 * is only stopped BECAUSE the pointer is resting on it would do nothing
 * visible. The pause button lives inside the container, so under
 * `pauseOnHover` the pointer is always on the marquee at the moment of the
 * press; without `'running'` the control would be permanently dead there.
 */
type ExplicitMotionState = 'paused' | 'running' | null;

/**
 * A pause button the library found in the container and took over.
 *
 * The element belongs to the integrator, so everything the library writes on it
 * is paired with the value it replaced — the same discipline the container
 * overflow above follows.
 */
interface BoundPauseButton {
  /** The integrator's button. */
  element: HTMLElement;
  /** The click listener, kept so `destroy()` can take it back off. */
  onClick: () => void;
  /** The {@link PAUSED_STATE_ATTRIBUTE} present before the library wrote state; null when none was. */
  previousState: string | null;
  /**
   * The inline `display` replaced while the button is hidden under reduced
   * motion. `null` means the library is not currently hiding it, which is what
   * keeps a second hide from recording `'none'` as the value to restore.
   */
  hiddenDisplay: string | null;
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

  /**
   * The reader's standing decision: a press of the pause button, {@link pause},
   * or {@link resume}. Outranks the two presence flags below, which is what
   * stops leaving hover or moving focus out from resuming a marquee the reader
   * deliberately paused.
   */
  private explicitMotion: ExplicitMotionState = null;
  /** Whether the pointer is currently inside the container. Only tracked under `pauseOnHover`. */
  private hoverInside: boolean = false;
  /** Whether focus is currently inside the container. Only tracked under `pauseOnFocus`. */
  private focusInside: boolean = false;

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
  private boundFocusIn: (() => void) | null = null;
  private boundFocusOut: ((event: FocusEvent) => void) | null = null;
  private pauseButtons: BoundPauseButton[] = [];
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
    this.options = { ...DEFAULT_OPTIONS, ...options };
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
    // Before the reduced-motion gate: if the preference already matches, GSAP
    // runs the freeze synchronously inside setupReducedMotionGate(), and the
    // freeze hides the button. Bound after that, it would sit there visible
    // with nothing left to control.
    this.setupPauseButton();
    // Owns starting motion (ticker + drag Observer) and, when the preference is
    // honored, the freeze/unfreeze lifecycle around it.
    this.setupReducedMotionGate();
    this.setupHoverPause();
    this.setupFocusPause();
    this.setupResizeHandler();

    this.initialized = true;
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
    return this.direction === 'ttb' || this.direction === 'btt';
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
      if (this.isMotionPaused() || this.destroyed || !this.moveTo) return;

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
    // The button has nothing left to control: motion is unstartable and
    // isPaused() already reports true. Hiding follows the APPLIED state, so a
    // marquee running with `respectReducedMotion: false` keeps its button.
    this.hidePauseButtons();
    this.syncPauseButtons();
  }

  /** Undoes {@link enterReducedMotion} and puts the marquee back in motion. */
  private exitReducedMotion(): void {
    this.reducedMotion = false;
    // Zeroed before the overflow goes back: `overflow: hidden` preserves the
    // scroll offset, so a marquee left displaced by the user would otherwise
    // animate from that offset with no way to scroll back.
    this.resetContainerScroll();
    this.restoreContainerOverflow();
    this.restorePauseButtons();
    this.syncPauseButtons();
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

    // Each handler records presence and nothing else. Previously mouseleave
    // called resume() outright, which quietly restarted a marquee the reader
    // had paused through the API — and would now do the same to a button press.
    this.boundMouseEnter = () => this.setPointerInside(true);
    this.boundMouseLeave = () => this.setPointerInside(false);

    this.container.addEventListener('mouseenter', this.boundMouseEnter);
    this.container.addEventListener('mouseleave', this.boundMouseLeave);
  }

  private setPointerInside(inside: boolean): void {
    this.hoverInside = inside;
    if (!inside) this.expireExplicitRun();
    this.syncPauseButtons();
  }

  /**
   * Pauses while focus sits inside the container — the keyboard counterpart to
   * hover, so a reader tabbing through the marquee's links is not chasing a
   * moving target.
   */
  private setupFocusPause(): void {
    if (!this.options.pauseOnFocus) return;

    this.boundFocusIn = () => this.setFocusInside(true);
    this.boundFocusOut = (event: FocusEvent) => {
      // focusout fires for every hop BETWEEN descendants, including the one
      // onto the pause button, and `relatedTarget` is where focus is going.
      // Without this check, tabbing from a link towards the pause control would
      // restart the marquee at the exact moment the reader reached for it —
      // leaving their focus inside a moving element.
      if (this.containsNode(event.relatedTarget)) return;

      this.setFocusInside(false);
    };

    // focusin/focusout rather than focus/blur: only the former pair bubbles, so
    // one listener on the container covers every descendant.
    this.container.addEventListener('focusin', this.boundFocusIn);
    this.container.addEventListener('focusout', this.boundFocusOut);
  }

  private setFocusInside(inside: boolean): void {
    this.focusInside = inside;
    if (!inside) this.expireExplicitRun();
    this.syncPauseButtons();
  }

  private containsNode(target: EventTarget | null): boolean {
    return target instanceof Node && this.container.contains(target);
  }

  /**
   * Retires an explicit "run" once the gesture it was overriding has ended, so
   * the next hover or tab-in pauses again rather than being permanently
   * suppressed by one old press.
   *
   * An explicit PAUSE is never retired here — outliving these gestures is the
   * entire point of it.
   */
  private expireExplicitRun(): void {
    if (this.explicitMotion !== 'running') return;
    if (this.hoverInside || this.focusInside) return;

    this.explicitMotion = null;
  }

  /**
   * Binds every pause button the integrator put in this container.
   *
   * Split three ways on purpose: locating the buttons is where all the failure
   * modes and diagnostics live, binding is bookkeeping, and the initial sync is
   * just state. Only this function knows the order.
   */
  private setupPauseButton(): void {
    if (!this.options.pauseButton) return;

    const elements = this.findPauseButtons();
    if (!elements.length) return;

    this.bindPauseButtons(elements);
    this.syncPauseButtons();
  }

  /**
   * The elements to bind, or an empty list — having warned about why.
   *
   * Scoped to `this.container`, not `document`: `initMarquee()` walks the whole
   * page, and a document-wide lookup would have the first marquee bind the
   * second one's button.
   *
   * Matches inside the track are rejected rather than bound. The wrapper is
   * cloned to fill the track, so a button placed there is duplicated into every
   * clone — and the clones are marked `aria-hidden` with `tabindex="-1"`, which
   * makes most of the copies unreachable anyway.
   *
   * All remaining matches are returned. One control is the norm, but a tall
   * vertical marquee reasonably carries one at each end, and keeping them in
   * sync is cheaper than picking a winner and explaining the choice.
   */
  private findPauseButtons(): HTMLElement[] {
    const selector = this.options.pauseButtonSelector;
    const matches = this.queryPauseButtons(selector);
    if (!matches) return [];

    const candidates = matches.filter(
      (element) => !this.track.contains(element),
    );

    if (!candidates.length) {
      this.warnMissingPauseButton(selector, matches.length > 0);
      return [];
    }

    this.warnUnoperablePauseButtons(candidates);

    return candidates;
  }

  /**
   * Runs the lookup, surviving a malformed selector.
   *
   * `querySelectorAll` throws on an invalid selector, and this runs inside
   * `initialize()` — so an unguarded throw would reject `ready`, skip the
   * reduced-motion gate and the resize handler, and leave
   * `data-marquee-initialized` behind, which makes a later `initMarquee()` pass
   * the element over. A typo in an optional accessory would take out the whole
   * marquee, irrecoverably. It degrades to "no button" instead.
   */
  private queryPauseButtons(selector: string): HTMLElement[] | null {
    try {
      return Array.from(this.container.querySelectorAll<HTMLElement>(selector));
    } catch (error) {
      console.warn(
        `Marquee: pauseButtonSelector "${selector}" is not a valid CSS ` +
          'selector, so no pause button was bound. The marquee itself is ' +
          'unaffected.',
        error,
      );
      return null;
    }
  }

  /**
   * Warns unconditionally, not behind an environment check. The package has no
   * environment detection at all and `vite.config.ts` defines none, so a
   * `process.env.NODE_ENV` guard would ship literally and throw
   * `ReferenceError: process is not defined` on the CDN path this repo
   * documents. `pauseButton: false` is the way to opt out.
   */
  private warnMissingPauseButton(selector: string, insideTrack: boolean): void {
    if (insideTrack) {
      console.warn(
        `Marquee: every element matching "${selector}" sits inside the track, ` +
          'where it would be duplicated into every clone. Move it out to be a ' +
          'sibling of the track.',
        this.container,
      );
      return;
    }

    console.warn(
      `Marquee: no pause button matching "${selector}" found in the container, ` +
        "so the only way to stop this marquee is the reader's OS reduced-motion " +
        'setting (WCAG 2.2.2). Add a <button data-marquee-pause-button> as a ' +
        'sibling of the track, or pass pauseButton: false to opt out.',
      this.container,
    );
  }

  /**
   * Flags a control the keyboard cannot reach. Bound anyway — a click listener
   * on a div still works for pointer users, and the element is the integrator's
   * call — but a pause mechanism only mouse users can operate does not satisfy
   * the criterion it exists for, and the library cannot give a div a role or a
   * tab stop without taking over markup it does not own.
   */
  private warnUnoperablePauseButtons(elements: HTMLElement[]): void {
    const unoperable = elements.filter(
      (element) => !element.matches(BUTTON_SEMANTICS_SELECTOR),
    );
    if (!unoperable.length) return;

    console.warn(
      `Marquee: ${unoperable.length} pause control(s) are neither a <button> ` +
        'nor role="button", so they are not keyboard operable and a ' +
        'keyboard-only reader has no way to stop this marquee (WCAG 2.2.2). ' +
        'Use a real <button>.',
      ...unoperable,
    );
  }

  private bindPauseButtons(elements: HTMLElement[]): void {
    elements.forEach((element) => {
      const onClick = () => this.togglePauseFromButton();
      element.addEventListener('click', onClick);

      this.pauseButtons.push({
        element,
        onClick,
        previousState: element.getAttribute(PAUSED_STATE_ATTRIBUTE),
        hiddenDisplay: null,
      });
    });
  }

  /**
   * Toggles against what the marquee is actually doing, not against the reader's
   * last press.
   *
   * Under `pauseOnHover` or `pauseOnFocus` the marquee is frequently already
   * stopped by the time the control can be reached — the button sits inside the
   * container, so hovering or tabbing to it is hovering or tabbing into the
   * marquee. Toggling off a press-history flag would make the first press
   * "pause" an already-stopped marquee: visibly nothing, and the label would
   * then contradict itself.
   */
  private togglePauseFromButton(): void {
    if (this.isPaused()) {
      this.resume();
      return;
    }

    this.pause();
  }

  /**
   * Mirrors the paused state onto every bound button as
   * {@link PAUSED_STATE_ATTRIBUTE}.
   *
   * State, not content. The APG carousel pattern swaps the button's LABEL with
   * its state ("Stop" / "Start"), and this attribute is the hook for doing
   * exactly that in CSS — but the library will not write the text itself, which
   * would clobber the integrator's copy and their translations.
   *
   * It tracks the EFFECTIVE state, including a hover or focus pause, so the
   * label can never tell the reader the marquee is moving while it sits still.
   */
  private syncPauseButtons(): void {
    if (!this.pauseButtons.length) return;

    const paused = this.isPaused() ? 'true' : 'false';
    this.pauseButtons.forEach((button) => {
      button.element.setAttribute(PAUSED_STATE_ATTRIBUTE, paused);
    });
  }

  /** Hides each bound button, recording the inline `display` it replaced. */
  private hidePauseButtons(): void {
    this.pauseButtons.forEach((button) => {
      if (button.hiddenDisplay !== null) return;

      // Inline rather than the `hidden` attribute: the documented CSS gives
      // marquee elements `display: flex`, and any such rule outranks
      // `[hidden]`'s UA default. An inline declaration cannot be outranked.
      button.hiddenDisplay = button.element.style.display;
      button.element.style.display = 'none';
    });
  }

  /** Puts the recorded inline `display` back verbatim; '' clears the declaration. */
  private restorePauseButtons(): void {
    this.pauseButtons.forEach((button) => {
      if (button.hiddenDisplay === null) return;

      button.element.style.display = button.hiddenDisplay;
      button.hiddenDisplay = null;
    });
  }

  /**
   * Hands each button back exactly as it was found: listener off, `display`
   * restored, and the state attribute either put back or removed if the library
   * was the one that introduced it.
   */
  private teardownPauseButtons(): void {
    this.restorePauseButtons();

    this.pauseButtons.forEach((button) => {
      button.element.removeEventListener('click', button.onClick);

      if (button.previousState === null) {
        button.element.removeAttribute(PAUSED_STATE_ATTRIBUTE);
        return;
      }

      button.element.setAttribute(PAUSED_STATE_ATTRIBUTE, button.previousState);
    });

    this.pauseButtons = [];
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

  /**
   * Pauses deliberately, and keeps it paused: hover and focus cannot lift this.
   * Only {@link resume}, or a press of the pause button, starts it again.
   */
  public pause(): void {
    this.explicitMotion = 'paused';
    this.syncPauseButtons();
  }

  /**
   * Resumes deliberately.
   *
   * This outranks a hover or focus pause rather than clearing it, so pressing
   * "play" moves a marquee the pointer is still resting on — the pause button
   * lives inside the container, so the pointer always is. The override retires
   * itself once the pointer leaves and focus moves out, and the next hover or
   * tab-in pauses normally again.
   *
   * No effect while reduced motion is active; the preference outranks this.
   */
  public resume(): void {
    this.explicitMotion = 'running';
    this.syncPauseButtons();
  }

  /** Whether any pause source is currently holding the ticker still. */
  private isMotionPaused(): boolean {
    if (this.explicitMotion) return this.explicitMotion === 'paused';

    return this.hoverInside || this.focusInside;
  }

  /**
   * True when the marquee is not advancing — whether because {@link pause} was
   * called, because hover or focus is holding it, or because reduced motion has
   * frozen it. Under reduced motion {@link resume} records the intent but
   * nothing moves, so reporting `false` there would be a lie.
   */
  public isPaused(): boolean {
    return this.isMotionPaused() || this.reducedMotion;
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

  public setDirection(direction: MarqueeDirection): void {
    const wasVertical = this.isVertical();
    this.direction = direction;

    // Crossing axes is NOT a supported operation (see the README): `moveTo` and
    // `originalSize` stay bound to the old axis, so the animation would keep
    // running the wrong one — tracked separately in #69. This branch is purely
    // defensive: if an integrator crosses anyway while frozen, at least the
    // container is left consistent rather than holding a scrollbar on an axis
    // nothing scrolls and none on the axis that needs it.
    if (this.reducedMotion && this.isVertical() !== wasVertical) {
      // Zeroed before the declaration moves, for the same reason
      // exitReducedMotion() does it: handing the old axis back to `overflow:
      // hidden` PRESERVES whatever offset the user scrolled to, stranding that
      // content off-screen with no scrollbar left on that axis to reach it.
      this.resetContainerScroll();
      this.restoreContainerOverflow();
      this.applyScrollOverflow();
    }
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

    if (this.boundFocusIn) {
      this.container.removeEventListener('focusin', this.boundFocusIn);
      this.boundFocusIn = null;
    }
    if (this.boundFocusOut) {
      this.container.removeEventListener('focusout', this.boundFocusOut);
      this.boundFocusOut = null;
    }

    // The matchMedia kill above already reverted the freeze, which restores a
    // hidden button; this is the belt-and-braces pass, and the only place the
    // click listener and the state attribute come back off.
    this.teardownPauseButtons();

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
