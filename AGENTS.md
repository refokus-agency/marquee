# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents working in `@refokus-agency/marquee`.

## Package Overview

GSAP-powered infinite marquee/carousel using **class-based OOP architecture**.

**Marquee Class** (`src/index.ts`):

- Encapsulates all marquee logic in a single class
- **Async initialization**: waits for images to load before calculating dimensions
- Private methods (no prefix, TypeScript `private` keyword)
- Public API: `pause()`, `resume()`, `setSpeed()`, `setDirection()`, `destroy()`
- State getters: `isPaused()`, `isDestroyed()`, `isReady()`, `getSpeed()`, `getDirection()`
- Readonly properties: `element`, `ready` (Promise)
- Static factory: `Marquee.create()` (async)

**Features:**

- Infinite seamless loop animation
- **Waits for images to load** before calculating dimensions
- Dynamic cloning based on container width (auto add/remove on resize)
- Configurable direction (LTR/RTL) and speed via data attributes
- Drag/touch interaction support via GSAP Observer
- Pause on hover and pause on focus options
- Binds an integrator-supplied pause button (WCAG 2.2.2); ships no CSS for it
- Separates **explicit** intent (API, button) from **transient** presence
  (hover, focus): a press outranks both directions, so leaving hover never
  resumes a deliberate pause and never re-pauses a deliberate resume
- Debounced resize handling (150ms)

## Required HTML Structure

The marquee requires a **3-level structure**:

```html
<!-- Container: clips content, provides width for calculations -->
<div class="marquee-container">
  <!-- Track: receives the transform animation -->
  <div class="marquee-track">
    <!-- Wrapper: gets cloned to fill the track -->
    <div data-marquee class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
    </div>
    <!-- Clones appended here automatically -->
  </div>
  <!-- Optional pause button: inside the container, OUTSIDE the track -->
  <button type="button" data-marquee-pause-button>Pause</button>
</div>
```

**Required CSS:**

```css
.marquee-container {
  max-width: 100%;
  overflow: hidden;
}
.marquee-track {
  display: flex;
  width: max-content;
  will-change: transform;
}
.marquee-wrapper {
  display: flex;
  flex-shrink: 0;
}
[data-marquee-item] {
  flex-shrink: 0;
}
```

**Data attributes:** `data-marquee-direction="rtl"`, `data-marquee-speed="2"`,
`data-marquee-pause-on-hover`, `data-marquee-pause-on-focus`,
`data-marquee-pause-button-enabled="false"` (opts out of the button and its
warning). `data-marquee-pause-button` goes on the button, not the wrapper.

### TypeScript

- Strict mode via `@total-typescript/tsconfig`
- File extensions required in imports (`.ts`)
- Separate `types.ts` files for type definitions

## Import Conventions

```typescript
// 1. External dependencies first
import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';

// 2. Internal imports (types separated)
import type { MarqueeConfig, MarqueeInstance } from './types.ts';
```

- Named imports preferred (avoid default imports)
- Use `import type { ... }` for type-only imports
- Include file extensions (`.ts`)
- Blank line between import groups

## Naming Conventions

| Type                    | Convention            | Examples                                     |
| ----------------------- | --------------------- | -------------------------------------------- |
| Files                   | kebab-case/lowercase  | `index.ts`, `types.ts`                       |
| Classes                 | PascalCase            | `Marquee`                                    |
| Class methods (public)  | camelCase             | `pause`, `resume`, `setSpeed`                |
| Class methods (private) | camelCase (no prefix) | `initialize`, `updateClones`, `handleResize` |
| Functions               | camelCase             | `initMarquee`, `createMarquee`               |
| Types/Interfaces        | PascalCase            | `MarqueeConfig`, `MarqueeOptions`            |
| Constants               | SCREAMING_SNAKE_CASE  | `DEFAULT_OPTIONS`, `RESIZE_DEBOUNCE_MS`      |
| Unused params           | `_` prefix            | `_event`, `_time`                            |

## Type Definitions

Place types in separate `types.ts` with JSDoc:

```typescript
/**
 * Configuration options for a Marquee instance
 */
export interface MarqueeOptions {
  /**
   * Speed multiplier for scroll animation
   * @default 1
   */
  speed?: number;
}
```

## Error Handling

```typescript
// Throw for critical conditions
if (!element) {
  throw new Error('Required element not found');
}

// Warn and continue for non-critical
try {
  const instance = create(el, opts);
} catch (error) {
  console.warn('Failed to initialize:', error);
}

// Return null for optional lookups
if (!wrapper) return null;
```

## Documentation Style

````typescript
/**
 * Initialize marquee on all matching elements.
 * Waits for images to load before calculating dimensions.
 *
 * @param config - Configuration options
 * @returns Promise resolving to array of marquee instances
 *
 * @example
 * ```typescript
 * const marquees = await initMarquee({ speed: 2 });
 * ```
 */
export async function initMarquee(config: MarqueeConfig = {}): Promise<Marquee[]> {
````

## Commits

Use Conventional Commits. Run `pnpm commit` for wizard.

```
feat(marquee): add pause on hover functionality
fix(marquee): correct clone calculation on resize
docs(readme): update HTML structure example
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
