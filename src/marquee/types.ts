/**
 * Direction of the marquee scroll
 */
export type MarqueeDirection = 'ltr' | 'rtl';

/**
 * Configuration options for a single Marquee instance
 */
export interface MarqueeOptions {
  /**
   * Speed of the automatic scroll animation (pixels per frame at 60fps)
   * @default 1
   */
  speed?: number;

  /**
   * Direction of the scroll: 'ltr' (left-to-right) or 'rtl' (right-to-left)
   * @default 'ltr'
   */
  direction?: MarqueeDirection;

  /**
   * Enable drag/touch interaction to control the marquee
   * @default true
   */
  draggable?: boolean;

  /**
   * Duration of the easing transition when dragging (in seconds)
   * @default 0.5
   */
  dragEase?: number;

  /**
   * Pause the animation on hover
   * @default false
   */
  pauseOnHover?: boolean;
}

/**
 * Configuration for initializing Marquee with selectors
 */
export interface MarqueeConfig extends MarqueeOptions {
  /**
   * Selector for the marquee wrapper element(s)
   * @default '[data-marquee]'
   */
  wrapperSelector?: string;

  /**
   * Selector for the items inside the marquee
   * @default '[data-marquee-item]'
   */
  itemSelector?: string;

  /**
   * Attribute name to read direction from the element
   * @default 'data-marquee-direction'
   */
  directionAttribute?: string;

  /**
   * Attribute name to read speed from the element
   * @default 'data-marquee-speed'
   */
  speedAttribute?: string;
}

/**
 * Marquee instance returned after initialization
 */
export interface MarqueeInstance {
  /**
   * The wrapper element
   */
  element: HTMLElement;

  /**
   * Pause the marquee animation
   */
  pause: () => void;

  /**
   * Resume the marquee animation
   */
  resume: () => void;

  /**
   * Check if the marquee is currently paused
   */
  isPaused: () => boolean;

  /**
   * Update the speed of the marquee
   */
  setSpeed: (speed: number) => void;

  /**
   * Update the direction of the marquee
   */
  setDirection: (direction: MarqueeDirection) => void;

  /**
   * Clean up and destroy the marquee instance
   */
  destroy: () => void;
}
