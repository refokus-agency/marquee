import { vi } from 'vitest';

/**
 * jsdom ships a `matchMedia` that always reports `matches: false` and never
 * fires a change event, so the interesting half of reduced-motion support —
 * what happens when the preference *flips* — is untestable against it.
 *
 * This installs a controllable replacement. Remove it with
 * `vi.unstubAllGlobals()`, which the suites already run in `afterEach`.
 */

const REDUCE_FEATURE = 'prefers-reduced-motion: reduce';
const NO_PREFERENCE_FEATURE = 'prefers-reduced-motion: no-preference';

/**
 * GSAP throttles its media-change handler to one run every 2 ms of wall time.
 * Two flips in the same tick would collapse into one, so tests that flip more
 * than once must wait this out between them.
 */
const GSAP_MEDIA_THROTTLE_MS = 5;

/** Handle for driving the stubbed preference after installation. */
export interface MatchMediaStub {
  /** Whether `(prefers-reduced-motion: reduce)` currently matches. */
  matches(): boolean;
  /**
   * Flips the preference and notifies every registered change listener
   * synchronously. Swallowed if GSAP handled another change under 2 ms ago —
   * prefer {@link MatchMediaStub.flip} unless the timing is already known good.
   */
  setReduce(next: boolean): void;
  /** Waits out GSAP's throttle, then {@link MatchMediaStub.setReduce}. */
  flip(next: boolean): Promise<void>;
}

/**
 * Replaces `window.matchMedia` with a stub that understands the
 * `prefers-reduced-motion` feature and can be flipped at runtime.
 *
 * Listeners live in the returned closure rather than on the individual
 * MediaQueryList objects, because GSAP re-creates a list on every change to
 * re-read `matches` while only ever registering its listener on the first one.
 */
export function installMatchMedia(initialReduce = false): MatchMediaStub {
  let reduce = initialReduce;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const evaluate = (query: string): boolean => {
    if (query.includes(REDUCE_FEATURE)) return reduce;
    if (query.includes(NO_PREFERENCE_FEATURE)) return !reduce;
    return false;
  };

  const createList = (query: string): MediaQueryList => {
    const list = {
      media: query,
      matches: evaluate(query),
      onchange: null,
      // GSAP prefers the legacy addListener when present, so both are wired to
      // the same registry.
      addListener: (fn: (event: MediaQueryListEvent) => void) => {
        listeners.add(fn);
      },
      removeListener: (fn: (event: MediaQueryListEvent) => void) => {
        listeners.delete(fn);
      },
      addEventListener: (
        _type: string,
        fn: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.add(fn);
      },
      removeEventListener: (
        _type: string,
        fn: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.delete(fn);
      },
      dispatchEvent: () => true,
    };

    return list as unknown as MediaQueryList;
  };

  vi.stubGlobal('matchMedia', (query: string) => createList(query));

  const stub: MatchMediaStub = {
    matches: () => reduce,

    setReduce(next: boolean): void {
      if (next === reduce) return;
      reduce = next;

      const event = {
        matches: reduce,
        media: `(${REDUCE_FEATURE})`,
      } as MediaQueryListEvent;

      listeners.forEach((fn) => fn(event));
    },

    async flip(next: boolean): Promise<void> {
      await waitForMediaThrottle();
      stub.setReduce(next);
    },
  };

  return stub;
}

/**
 * Removes `matchMedia` entirely, standing in for a browser too old to have the
 * API at all. Restored by `vi.unstubAllGlobals()`.
 */
export function removeMatchMedia(): void {
  vi.stubGlobal('matchMedia', undefined);
}

/**
 * Installs a `matchMedia` that exists but does not understand
 * `prefers-reduced-motion`, so BOTH `reduce` and `no-preference` report false.
 *
 * This is a different code path from {@link removeMatchMedia}: the feature-detect
 * guard passes here, a real query gets registered, and it simply never matches.
 * It is also the exact case that makes gating on `reduce` rather than
 * `no-preference` the safe choice — the latter would never match either, and the
 * marquee would sit permanently frozen.
 */
export function installUnsupportedMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList,
  );
}

/** Waits out GSAP's media-change throttle so a following flip is not swallowed. */
function waitForMediaThrottle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, GSAP_MEDIA_THROTTLE_MS));
}
