import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';

import type {
  MarqueeConfig,
  MarqueeDirection,
  MarqueeOptions,
} from './types.ts';

export type {
  MarqueeConfig,
  MarqueeDirection,
  MarqueeOptions,
} from './types.ts';

gsap.registerPlugin(Observer);

const DEFAULT_OPTIONS: Required<MarqueeOptions> = {
  speed: 1,
  direction: 'ltr',
  draggable: true,
  dragEase: 0.5,
  pauseOnHover: false,
};

const DEFAULT_CONFIG: Required<MarqueeConfig> = {
  ...DEFAULT_OPTIONS,
  wrapperSelector: '[data-marquee]',
  itemSelector: '[data-marquee-item]',
  directionAttribute: 'data-marquee-direction',
  speedAttribute: 'data-marquee-speed',
};

const RESIZE_DEBOUNCE_MS = 150;

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Waits for all images within an element to finish loading.
 * Returns immediately if no images or all images are already loaded.
 */
function waitForImages(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll<HTMLImageElement>('img');
  if (!images.length) return Promise.resolve();

  const pending = Array.from(images).filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();

  return Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => {});
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
  private originalWidth: number = 0;
  private clones: HTMLElement[] = [];

  private tickerCallback: ((time: number, deltaTime: number) => void) | null =
    null;
  private observer: Observer | null = null;
  private resizeHandler: (() => void) | null = null;
  private boundMouseEnter: (() => void) | null = null;
  private boundMouseLeave: (() => void) | null = null;
  private xTo: gsap.QuickToFunc | null = null;
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
    await waitForImages(this.element);

    if (this.destroyed) return;

    // Mark element as initialized to prevent double-initialization
    this.element.setAttribute('data-marquee-initialized', 'true');

    this.originalWidth = this.element.offsetWidth;
    this.wrap = gsap.utils.wrap(-this.originalWidth, 0);
    this.xTo = this.createQuickTo();

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

  private createQuickTo(): gsap.QuickToFunc {
    return gsap.quickTo(this.track, 'x', {
      duration: this.options.dragEase,
      ease: 'power3',
      modifiers: {
        x: gsap.utils.unitize(this.wrap!),
      },
    });
  }

  /**
   * Calculates and manages clones to fill 2x container width for seamless looping
   */
  private updateClones(): void {
    const containerWidth = this.container.clientWidth;
    const wrappersNeeded = Math.max(
      2,
      Math.ceil((containerWidth * 2) / this.originalWidth) + 1,
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
      if (this.paused || this.destroyed || !this.xTo) return;

      const directionMultiplier = this.direction === 'rtl' ? -1 : 1;
      this.position -= (deltaTime / 15) * this.speed * directionMultiplier;
      this.xTo(this.position);
    };

    gsap.ticker.add(this.tickerCallback);
  }

  private setupDragInteraction(): void {
    if (!this.options.draggable) return;

    this.observer = Observer.create({
      target: this.track,
      type: 'pointer,touch',
      onDrag: (self) => {
        if (!this.xTo) return;
        this.position += self.deltaX;
        this.xTo(this.position);
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

    this.originalWidth = this.element.offsetWidth;
    this.updateClones();

    this.wrap = gsap.utils.wrap(-this.originalWidth, 0);
    this.xTo = this.createQuickTo();

    this.position = this.wrap(this.position);
    this.xTo(this.position);
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

    gsap.set(this.track, { x: 0 });
  }
}

/**
 * Initialize marquee on all matching elements. Waits for images to load.
 *
 * @example
 * ```typescript
 * const marquees = await initMarquee({ speed: 2, direction: 'rtl' });
 * marquees.forEach(m => m.pause());
 * ```
 */
export async function initMarquee(
  config: MarqueeConfig = {},
): Promise<Marquee[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    wrapperSelector,
    itemSelector: _itemSelector,
    directionAttribute,
    speedAttribute,
    ...defaultOptions
  } = mergedConfig;

  const wrappers = document.querySelectorAll<HTMLElement>(wrapperSelector);
  if (!wrappers.length) return [];

  const promises: Array<Promise<Marquee | null>> = [];

  wrappers.forEach((wrapper) => {
    // Skip clones and already-initialized elements
    if (wrapper.hasAttribute('data-marquee-clone')) return;
    if (wrapper.hasAttribute('data-marquee-initialized')) return;

    const elementDirection = wrapper.getAttribute(
      directionAttribute,
    ) as MarqueeDirection | null;
    const elementSpeed = wrapper.getAttribute(speedAttribute);

    const options: MarqueeOptions = {
      ...defaultOptions,
      direction: elementDirection || defaultOptions.direction,
      speed: elementSpeed ? parseFloat(elementSpeed) : defaultOptions.speed,
    };

    const promise = Marquee.create(wrapper, options).catch((error) => {
      console.warn('Failed to initialize marquee:', error);
      return null;
    });

    promises.push(promise);
  });

  const results = await Promise.all(promises);
  return results.filter((instance): instance is Marquee => instance !== null);
}

/**
 * Create a single Marquee instance from an element or selector. Waits for images to load.
 *
 * @example
 * ```typescript
 * const marquee = await createMarquee('#my-marquee', { speed: 1.5 });
 * marquee?.pause();
 * ```
 */
export async function createMarquee(
  element: HTMLElement | string,
  options: MarqueeOptions = {},
): Promise<Marquee | null> {
  const wrapper =
    typeof element === 'string'
      ? document.querySelector<HTMLElement>(element)
      : element;

  if (!wrapper) return null;

  try {
    return await Marquee.create(wrapper, options);
  } catch (error) {
    console.warn('Failed to create marquee:', error);
    return null;
  }
}
