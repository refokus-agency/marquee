import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clampFrameDelta,
  debounce,
  getTrackGap,
  waitForImages,
  waitForViewport,
} from '../utils.ts';

describe('clampFrameDelta', () => {
  it('returns the delta unchanged when below the max', () => {
    expect(clampFrameDelta(16, 100)).toBe(16);
  });

  it('returns the max when the delta exceeds it (tab resume spike)', () => {
    expect(clampFrameDelta(5000, 100)).toBe(100);
  });

  it('returns the delta when equal to the max', () => {
    expect(clampFrameDelta(100, 100)).toBe(100);
  });
});

describe('getTrackGap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the column gap for horizontal marquees', () => {
    const track = document.createElement('div');
    track.style.columnGap = '20px';
    document.body.appendChild(track);

    expect(getTrackGap(track, false)).toBe(20);
  });

  it('reads the row gap for vertical marquees', () => {
    const track = document.createElement('div');
    track.style.rowGap = '32px';
    document.body.appendChild(track);

    expect(getTrackGap(track, true)).toBe(32);
  });

  it('returns 0 when no gap is set', () => {
    const track = document.createElement('div');
    document.body.appendChild(track);

    expect(getTrackGap(track, false)).toBe(0);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls when called again within delay', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the debounced function', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('waitForViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should resolve immediately when IntersectionObserver is not available', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const element = document.createElement('div');
    await expect(waitForViewport(element)).resolves.toBeUndefined();
  });

  it('should resolve when observer fires with isIntersecting true', async () => {
    type IOCallback = (entries: IntersectionObserverEntry[]) => void;
    let capturedCallback: IOCallback | null = null;

    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (cb: IOCallback) {
        capturedCallback = cb;
        return mockObserver;
      }),
    );

    const element = document.createElement('div');
    const promise = waitForViewport(element);

    expect(mockObserver.observe).toHaveBeenCalledWith(element);

    capturedCallback!([{ isIntersecting: true } as IntersectionObserverEntry]);

    await expect(promise).resolves.toBeUndefined();
    expect(mockObserver.disconnect).toHaveBeenCalled();
  });

  it('should not resolve when observer fires with isIntersecting false', async () => {
    type IOCallback = (entries: IntersectionObserverEntry[]) => void;
    let capturedCallback: IOCallback | null = null;

    const mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (cb: IOCallback) {
        capturedCallback = cb;
        return mockObserver;
      }),
    );

    const element = document.createElement('div');
    const promise = waitForViewport(element);

    capturedCallback!([{ isIntersecting: false } as IntersectionObserverEntry]);

    const result = await Promise.race([
      promise.then(() => 'resolved'),
      Promise.resolve('pending'),
    ]);
    expect(result).toBe('pending');
    expect(mockObserver.disconnect).not.toHaveBeenCalled();
  });
});

describe('waitForImages', () => {
  beforeEach(() => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  it('should resolve immediately when element has no images', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>No images here</p>';

    await expect(waitForImages(element)).resolves.toBeUndefined();
  });

  it('should resolve immediately when all images are already loaded', async () => {
    const element = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: true });
    element.appendChild(img);

    await expect(waitForImages(element)).resolves.toBeUndefined();
  });

  it('should wait for pending images to load', async () => {
    const element = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false, writable: true });
    element.appendChild(img);

    const promise = waitForImages(element);

    // Simulate image load
    img.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should resolve even if image fails to load', async () => {
    const element = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false, writable: true });
    element.appendChild(img);

    const promise = waitForImages(element);

    // Simulate image error
    img.dispatchEvent(new Event('error'));

    await expect(promise).resolves.toBeUndefined();
  });
});
