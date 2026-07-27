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
  wrapperSelector: '[data-marquee]',
  itemSelector: '[data-marquee-item]',
  directionAttribute: 'data-marquee-direction',
  speedAttribute: 'data-marquee-speed',
  draggableAttribute: 'data-marquee-draggable',
  pauseOnHoverAttribute: 'data-marquee-pause-on-hover',
};

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
    draggableAttribute,
    pauseOnHoverAttribute,
    ...defaultOptions
  } = mergedConfig;

  const wrappers = document.querySelectorAll<HTMLElement>(wrapperSelector);
  if (!wrappers.length) return [];

  const promises: Promise<Marquee | null>[] = [];

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
