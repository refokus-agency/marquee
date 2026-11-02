import type {
  MarqueeConfig,
  MarqueeDirection,
  MarqueeOptions,
} from './types.ts';
import { Marquee } from './Marquee.ts';

export { Marquee } from './Marquee.ts';
export type {
  MarqueeConfig,
  MarqueeDirection,
  MarqueeOptions,
} from './types.ts';

const DEFAULT_CONFIG: Required<MarqueeConfig> = {
  speed: 1,
  direction: 'ltr',
  draggable: false,
  dragEase: 0.5,
  pauseOnHover: false,
  respectReducedMotion: true,
  wrapperSelector: '[data-marquee]',
  directionAttribute: 'data-marquee-direction',
  speedAttribute: 'data-marquee-speed',
  draggableAttribute: 'data-marquee-draggable',
  pauseOnHoverAttribute: 'data-marquee-pause-on-hover',
  respectReducedMotionAttribute: 'data-marquee-respect-reduced-motion',
};

/**
 * Initialize marquee on all matching elements.
 *
 * Returns the instances synchronously, before any of them is ready. Each one
 * defers its measuring until its container enters the viewport, so awaiting
 * every marquee would hang on one that is never scrolled to. Await only the
 * ones you need via `marquee.ready`, and call `destroy()` on any of them at
 * any time, including ones that never entered the viewport.
 *
 * Elements whose construction throws are skipped with a warning, and an
 * initialization failure is logged rather than left as an unhandled rejection.
 *
 * @example
 * ```typescript
 * const marquees = initMarquee({ speed: 2, direction: 'rtl' });
 * await marquees[0]?.ready;
 * marquees[0]?.pause();
 * ```
 */
export function initMarquee(config: MarqueeConfig = {}): Marquee[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    wrapperSelector,
    directionAttribute,
    speedAttribute,
    draggableAttribute,
    pauseOnHoverAttribute,
    respectReducedMotionAttribute,
    ...defaultOptions
  } = mergedConfig;

  const wrappers = document.querySelectorAll<HTMLElement>(wrapperSelector);
  const instances: Marquee[] = [];

  wrappers.forEach((wrapper) => {
    // Skip clones and already-initialized elements
    if (wrapper.hasAttribute('data-marquee-clone')) return;
    if (wrapper.hasAttribute('data-marquee-initialized')) return;

    const elementDirection = wrapper.getAttribute(
      directionAttribute,
    ) as MarqueeDirection | null;
    const elementSpeed = wrapper.getAttribute(speedAttribute);
    const elementDraggable = wrapper.getAttribute(draggableAttribute);
    const elementPauseOnHover = wrapper.getAttribute(pauseOnHoverAttribute);
    const elementRespectReducedMotion = wrapper.getAttribute(
      respectReducedMotionAttribute,
    );

    const options: MarqueeOptions = {
      ...defaultOptions,
      direction: elementDirection || defaultOptions.direction,
      speed: elementSpeed ? parseFloat(elementSpeed) : defaultOptions.speed,
      draggable:
        elementDraggable !== null
          ? elementDraggable !== 'false'
          : defaultOptions.draggable,
      pauseOnHover:
        elementPauseOnHover !== null
          ? elementPauseOnHover !== 'false'
          : defaultOptions.pauseOnHover,
      respectReducedMotion:
        elementRespectReducedMotion !== null
          ? elementRespectReducedMotion !== 'false'
          : defaultOptions.respectReducedMotion,
    };

    try {
      const instance = new Marquee(wrapper, options);
      instance.ready.catch((error) => {
        console.warn('Failed to initialize marquee:', error);
      });
      instances.push(instance);
    } catch (error) {
      console.warn('Failed to initialize marquee:', error);
    }
  });

  return instances;
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
