/**
 * Reads the flex gap of the marquee track along the scroll axis.
 * The track lays its wrapper + clones out as flex children, so the visual
 * distance between one wrapper and the next is its size PLUS this gap.
 * Returns 0 when no gap is set (computed value is `normal` / empty → NaN).
 */
export function getTrackGap(track: HTMLElement, vertical: boolean): number {
  const styles = getComputedStyle(track);
  const raw = vertical ? styles.rowGap : styles.columnGap;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Clamps a per-frame delta (ms) to a maximum.
 *
 * When the tab is backgrounded (or the main thread stalls) requestAnimationFrame
 * pauses, so on resume the first `deltaTime` equals the whole elapsed time —
 * seconds or minutes. GSAP normally absorbs this with lagSmoothing, but hosts
 * that disable it (e.g. Lenis calls `gsap.ticker.lagSmoothing(0)`) pass the raw
 * spike straight through, making the marquee leap forward. Clamping keeps a
 * single frame from advancing more than one slow frame's worth of motion.
 */
export function clampFrameDelta(deltaTime: number, maxMs: number): number {
  return deltaTime > maxMs ? maxMs : deltaTime;
}

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified delay has elapsed since the last call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
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
 * Resolves when the element enters the viewport (or immediately if already visible).
 * Falls back to resolving immediately if IntersectionObserver is not available.
 * Accepts an optional AbortSignal — if aborted, disconnects the observer and resolves immediately.
 */
export function waitForViewport(
  element: HTMLElement,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof IntersectionObserver === 'undefined') {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          resolve();
        }
      },
      { threshold: 0 },
    );
    observer.observe(element);

    signal?.addEventListener(
      'abort',
      () => {
        observer.disconnect();
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Waits for all images within an element to finish loading.
 * Returns immediately if no images or all images are already loaded.
 */
export function waitForImages(element: HTMLElement): Promise<void> {
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
