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
};

const RESIZE_DEBOUNCE_MS = 150;

/**
 * Upper bound (ms) for a single ticker frame. Above this we assume the tab was
 * backgrounded or the thread stalled and cap the advance so the marquee never
 * leaps forward when rAF resumes. See {@link clampFrameDelta}.
 */
const MAX_FRAME_DELTA_MS = 100;

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
    this.wrap = gsap.utils.wrap(-this.originalSize, 0);
    this.moveTo = this.createQuickTo();

    this.updateClones();
    this.setupAnimation();
    this.setupDragInteraction();
    this.setupHoverPause();
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
      this.track.appendChild(clone);
      this.clones.push(clone);
    }

    while (this.clones.length > clonesNeeded) {
      const clone = this.clones.pop();
      clone?.remove();
    }
  }

  private setupAnimation(): void {
    this.tickerCallback = (_time: number, deltaTime: number) => {
      if (this.paused || this.destroyed || !this.moveTo) return;

      const directionMultiplier =
        this.direction === 'rtl' || this.direction === 'ttb' ? -1 : 1;
      const delta = clampFrameDelta(deltaTime, MAX_FRAME_DELTA_MS);
      this.position -= (delta / 15) * this.speed * directionMultiplier;
      this.moveTo(this.position);
    };

    gsap.ticker.add(this.tickerCallback);
  }

  private setupDragInteraction(): void {
    if (!this.options.draggable) return;

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
    this.moveTo = this.createQuickTo();

    this.position = this.wrap(this.position);
    this.moveTo(this.position);
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public isPaused(): boolean {
    return this.paused;
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

    if (this.tickerCallback) {
      gsap.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }

    if (this.observer) {
      this.observer.kill();
      this.observer = null;
    }

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

    gsap.set(this.track, this.isVertical() ? { y: 0 } : { x: 0 });
  }
}
