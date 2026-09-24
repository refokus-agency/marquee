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
   * Pause the animation while focus is inside the marquee container.
   *
   * The pause button counts as inside, so tabbing from a link towards the
   * control does not restart the marquee under the reader's hands. Pressing it
   * then resumes, because the button toggles against what the marquee is
   * actually doing rather than against its own press history.
   * @default false
   */
  pauseOnFocus?: boolean;

  /**
   * Bind a pause button, when one is present inside the marquee container.
   *
   * The button is the integrator's own markup — the library neither injects nor
   * styles it — and is found via {@link MarqueeOptions.pauseButtonSelector}.
   * With this `true` and nothing matching, the library warns: a marquee with no
   * in-page control leaves WCAG 2.2.2 resting entirely on the reader having
   * found their OS reduced-motion setting. Set to `false` for a marquee that
   * deliberately ships no button, which also silences the warning.
   * @default true
   */
  pauseButton?: boolean;

  /**
   * Selector for the pause button, resolved against the marquee container so a
   * page with several marquees never binds a neighbour's control.
   *
   * The button must be a sibling of the track, not inside the wrapper: the
   * wrapper is cloned to fill the track, and a button placed there would be
   * duplicated into every clone. Every match outside the track is bound and
   * kept in sync, so a long marquee can carry a control at each end.
   * @default '[data-marquee-pause-button]'
   */
  pauseButtonSelector?: string;

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
   * Selector for the items inside the marquee
   * @deprecated This option has no effect. The marquee treats the wrapper as an
   * atomic unit and never queries its items, so the selector is ignored. It is
   * kept only for backward compatibility and will be removed in `2.0.0` — see
   * https://github.com/refokus-agency/marquee/issues/67
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
   * Attribute name to read pauseOnFocus from the element
   * @default 'data-marquee-pause-on-focus'
   */
  pauseOnFocusAttribute?: string;

  /**
   * Attribute name to read pauseButton from the element
   * @default 'data-marquee-pause-button-enabled'
   */
  pauseButtonAttribute?: string;

  /**
   * Attribute name to read respectReducedMotion from the element
   * @default 'data-marquee-respect-reduced-motion'
   */
  respectReducedMotionAttribute?: string;
}
