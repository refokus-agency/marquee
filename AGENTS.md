# AGENTS.md - Coding Agent Guidelines

Guidelines for AI coding agents working in `@refokus-agency/marquee`.

## Package Overview

GSAP-powered infinite marquee/carousel using **class-based OOP architecture**.

**Marquee Class** (`src/index.ts`):
Encapsulates all marquee logic in a single class

## Required HTML Structure
Read the section HTML Structure in README.md file

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
