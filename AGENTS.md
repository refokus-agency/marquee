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
- Pause on hover option
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

**Data attributes:** `data-marquee-direction="rtl"`, `data-marquee-speed="2"`

## Build/Lint/Test Commands

| Command             | Description                 |
| ------------------- | --------------------------- |
| `pnpm build`        | Compile TypeScript to dist/ |
| `pnpm build:clean`  | Clean dist/ and rebuild     |
| `pnpm test`         | Run all tests (Vitest)      |
| `pnpm lint`         | Run ESLint with auto-fix    |
| `pnpm format`       | Format code with Prettier   |
| `pnpm check-types`  | TypeScript type checking    |
| `pnpm commit`       | Conventional commit wizard  |

### Running a Single Test

```bash
pnpm exec vitest run src/__tests__/index.test.ts  # specific file
pnpm exec vitest run -t "should export"           # by pattern
pnpm exec vitest src/__tests__/index.test.ts      # watch mode
```

**Requirements**: Node.js >= 22.0.0, GSAP >= 3.12.0 (peer dependency)

## Code Style

### Formatting (Prettier)

- 2 spaces indentation (no tabs)
- Single quotes
- Semicolons always required
- Trailing commas everywhere

### ESLint

- `no-console`: allowed
- `@typescript-eslint/no-explicit-any`: allowed
- `@typescript-eslint/no-unused-vars`: warn, prefix unused with `_`
- Use simple array syntax (`string[]` not `Array<string>`)

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
| Unused params           | `_` prefix            | `_itemSelector`, `_time`                     |

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

## Test Patterns

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Marquee Exports', () => {
  it('should export Marquee class', async () => {
    const { Marquee } = await import('../index.ts');
    expect(Marquee).toBeDefined();
    expect(typeof Marquee.prototype.pause).toBe('function');
    expect(typeof Marquee.prototype.isReady).toBe('function');
    expect(typeof Marquee.create).toBe('function');
  });
});

describe('Marquee - Async Factory Functions', () => {
  it('initMarquee should return empty array when no elements', async () => {
    const { initMarquee } = await import('../index.ts');
    const instances = await initMarquee({ wrapperSelector: '.non-existent' });
    expect(instances).toEqual([]);
  });

  it('createMarquee should return null for non-existent selector', async () => {
    const { createMarquee } = await import('../index.ts');
    const instance = await createMarquee('#non-existent');
    expect(instance).toBeNull();
  });
});

describe('Marquee - DOM Structure', () => {
  it('should throw error when wrapper has no parent', async () => {
    const { Marquee } = await import('../index.ts');
    const wrapper = document.createElement('div');
    expect(() => new Marquee(wrapper)).toThrow('must have a parent element');
  });
});
```

## Project Structure

```
src/
├── index.ts          # Marquee class + factory functions + exports
├── types.ts          # MarqueeOptions, MarqueeConfig, MarqueeDirection
└── __tests__/
    └── index.test.ts
```

## Commits

Use Conventional Commits. Run `pnpm commit` for wizard.

```
feat(marquee): add pause on hover functionality
fix(marquee): correct clone calculation on resize
docs(readme): update HTML structure example
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
