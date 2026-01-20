import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, waitForImages } from '../utils.ts';

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
