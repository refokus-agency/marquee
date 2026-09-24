/**
 * Direction of the marquee scroll
 */
export type MarqueeDirection = 'ltr' | 'rtl' | 'ttb' | 'btt';

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
   * Direction of the scroll: 'ltr' (left-to-right), 'rtl' (right-to-left),
   * 'ttb' (top-to-bottom), or 'btt' (bottom-to-top)
   * @default 'ltr'
   */
  direction?: MarqueeDirection;

  /**
   * Enable drag/touch interaction to control the marquee
   * @default false
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

  /**
   * Honor the operating system's `prefers-reduced-motion: reduce` setting.
   * While the preference is active the marquee freezes at its start position
   * and the container becomes natively scrollable so the content stays
   * reachable. Set to `false` to animate regardless of the preference.
   * @default true
   */
  respectReducedMotion?: boolean;
}

/**
 * Configuration for initializing multiple Marquee instances with selectors
 */
export interface MarqueeConfig extends MarqueeOptions {
  /**
   * Selector for the marquee wrapper element(s)
   * @default '[data-marquee]'
   */
  wrapperSelector?: string;

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

  /**
   * Attribute name to read draggable from the element
   * @default 'data-marquee-draggable'
   */
  draggableAttribute?: string;

  /**
   * Attribute name to read pauseOnHover from the element
   * @default 'data-marquee-pause-on-hover'
   */
  pauseOnHoverAttribute?: string;

  /**
   * Attribute name to read respectReducedMotion from the element
   * @default 'data-marquee-respect-reduced-motion'
   */
  respectReducedMotionAttribute?: string;
}
