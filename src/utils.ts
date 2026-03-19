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
 */
export function waitForViewport(element: HTMLElement): Promise<void> {
  if (typeof IntersectionObserver === 'undefined') {
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
