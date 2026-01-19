import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';

import type {
  MarqueeConfig,
  MarqueeDirection,
  MarqueeInstance,
  MarqueeOptions,
} from './types.ts';

// Register GSAP plugin
gsap.registerPlugin(Observer);

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<MarqueeConfig> = {
  wrapperSelector: '[data-marquee]',
  itemSelector: '[data-marquee-item]',
  directionAttribute: 'data-marquee-direction',
  speedAttribute: 'data-marquee-speed',
  speed: 1,
  direction: 'ltr',
  draggable: true,
  dragEase: 0.5,
  pauseOnHover: false,
};

/**
 * Creates a debounced function
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
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
 * Creates a marquee instance for a single element
 * 
 * Structure expected:
 * - Container (grandparent): max-width: 100%, overflow: hidden - used for width calculation
 * - Track (parent): display: flex, width: max-content - gets the transform applied
 * - Wrapper ([data-marquee]): gets cloned to fill the track
 */
function createMarqueeInstance(
  wrapper: HTMLElement,
  options: Required<MarqueeOptions>
): MarqueeInstance {
  let { speed, direction } = options;
  const { draggable, dragEase, pauseOnHover } = options;

  let paused = false;
  let total = 0;
  let tickerCallback: ((time: number, deltaTime: number) => void) | null = null;
  let observer: Observer | null = null;
  let resizeHandler: (() => void) | null = null;

  // Get the track (parent) - this is the flex container that gets transformed
  const trackElement = wrapper.parentElement;
  if (!trackElement) {
    throw new Error('Marquee wrapper must have a parent element (track)');
  }
  const track: HTMLElement = trackElement;

  // Get the container (grandparent) - this has overflow:hidden and max-width:100%
  // Used for calculating available width
  const containerElement = track.parentElement;
  if (!containerElement) {
    throw new Error('Marquee track must have a parent element (container)');
  }
  const container: HTMLElement = containerElement;

  // Store reference to original wrapper content width
  let originalWidth = wrapper.offsetWidth;
  let clones: HTMLElement[] = [];

  /**
   * Calculate and manage clones to fill the container
   */
  function updateClones(): void {
    // Use container width for calculating how many clones needed
    const containerWidth = container.clientWidth;

    // Calculate how many total wrappers we need (original + clones)
    // We need enough to fill at least 2x container width for seamless looping
    const wrappersNeeded = Math.max(2, Math.ceil((containerWidth * 2) / originalWidth) + 1);
    const clonesNeeded = wrappersNeeded - 1; // Subtract the original

    // Add clones if needed
    while (clones.length < clonesNeeded) {
      const clone = wrapper.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-marquee-clone', 'true');
      clone.removeAttribute('id'); // Remove ID to avoid duplicates
      track.appendChild(clone);
      clones.push(clone);
    }

    // Remove excess clones if needed
    while (clones.length > clonesNeeded) {
      const clone = clones.pop();
      clone?.remove();
    }
  }

  /**
   * Recalculate wrap point based on current content
   */
  function getWrapPoint(): number {
    return originalWidth;
  }

  // Initial clone setup
  updateClones();

  // Create wrap function
  let wrap = gsap.utils.wrap(-getWrapPoint(), 0);

  // Create quick setter for smooth animations - apply to track
  let xTo = gsap.quickTo(track, 'x', {
    duration: dragEase,
    ease: 'power3',
    modifiers: {
      x: gsap.utils.unitize(wrap),
    },
  });

  /**
   * Handle resize - recalculate clones and wrap point
   */
  function handleResize(): void {
    // Recalculate original width (in case of responsive changes)
    originalWidth = wrapper.offsetWidth;

    // Update clones
    updateClones();

    // Recreate wrap function with new dimensions
    wrap = gsap.utils.wrap(-getWrapPoint(), 0);

    // Recreate quick setter
    xTo = gsap.quickTo(track, 'x', {
      duration: dragEase,
      ease: 'power3',
      modifiers: {
        x: gsap.utils.unitize(wrap),
      },
    });

    // Reset position to avoid jump
    total = wrap(total);
    xTo(total);
  }

  // Debounced resize handler
  resizeHandler = debounce(handleResize, 150);
  window.addEventListener('resize', resizeHandler);

  // Get direction multiplier
  const getDirectionMultiplier = (): number => (direction === 'rtl' ? -1 : 1);

  // Animation tick function
  tickerCallback = (_time: number, deltaTime: number) => {
    if (paused) return;
    total -= (deltaTime / 15) * speed * getDirectionMultiplier();
    xTo(total);
  };

  // Add ticker for continuous animation
  gsap.ticker.add(tickerCallback);

  // Setup drag interaction on track
  if (draggable) {
    observer = Observer.create({
      target: track,
      type: 'pointer,touch',
      onDrag: (self) => {
        total += self.deltaX;
        xTo(total);
      },
    });
  }

  // Setup hover pause on container
  if (pauseOnHover) {
    container.addEventListener('mouseenter', () => {
      paused = true;
    });
    container.addEventListener('mouseleave', () => {
      paused = false;
    });
  }

  // Return instance API
  return {
    element: wrapper,

    pause: () => {
      paused = true;
    },

    resume: () => {
      paused = false;
    },

    isPaused: () => paused,

    setSpeed: (newSpeed: number) => {
      speed = newSpeed;
    },

    setDirection: (newDirection: MarqueeDirection) => {
      direction = newDirection;
    },

    destroy: () => {
      // Remove ticker
      if (tickerCallback) {
        gsap.ticker.remove(tickerCallback);
        tickerCallback = null;
      }

      // Remove observer
      if (observer) {
        observer.kill();
        observer = null;
      }

      // Remove resize listener
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }

      // Remove all clones
      clones.forEach((clone) => clone.remove());
      clones = [];

      // Reset transform
      gsap.set(track, { x: 0 });
    },
  };
}

/**
 * Initialize marquee on all matching elements
 *
 * @param config - Configuration options
 * @returns Array of marquee instances
 *
 * @example
 * ```typescript
 * // Basic usage with default selectors
 * const marquees = initMarquee();
 *
 * // With custom options
 * const marquees = initMarquee({
 *   speed: 2,
 *   direction: 'rtl',
 *   pauseOnHover: true,
 * });
 *
 * // Control instances
 * marquees.forEach(m => m.pause());
 * ```
 */
export function initMarquee(config: MarqueeConfig = {}): MarqueeInstance[] {
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

  const instances: MarqueeInstance[] = [];

  wrappers.forEach((wrapper) => {
    // Skip clones
    if (wrapper.hasAttribute('data-marquee-clone')) return;

    // Read options from element attributes (override defaults)
    const elementDirection = wrapper.getAttribute(directionAttribute) as MarqueeDirection | null;
    const elementSpeed = wrapper.getAttribute(speedAttribute);

    const options: Required<MarqueeOptions> = {
      ...defaultOptions,
      direction: elementDirection || defaultOptions.direction,
      speed: elementSpeed ? parseFloat(elementSpeed) : defaultOptions.speed,
    };

    try {
      const instance = createMarqueeInstance(wrapper, options);
      instances.push(instance);
    } catch (error) {
      console.warn('Failed to initialize marquee:', error);
    }
  });

  return instances;
}

/**
 * Initialize marquee on a single element
 *
 * @param element - The wrapper element or selector
 * @param options - Configuration options
 * @returns Marquee instance or null if element not found
 *
 * @example
 * ```typescript
 * const marquee = createMarquee('#my-marquee', {
 *   speed: 1.5,
 *   pauseOnHover: true,
 * });
 *
 * if (marquee) {
 *   marquee.pause();
 *   marquee.setSpeed(2);
 *   marquee.resume();
 * }
 * ```
 */
export function createMarquee(
  element: HTMLElement | string,
  options: MarqueeOptions = {}
): MarqueeInstance | null {
  const wrapper =
    typeof element === 'string'
      ? document.querySelector<HTMLElement>(element)
      : element;

  if (!wrapper) return null;

  const mergedOptions: Required<MarqueeOptions> = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  try {
    return createMarqueeInstance(wrapper, mergedOptions);
  } catch (error) {
    console.warn('Failed to create marquee:', error);
    return null;
  }
}
