# @refokus-agency/marquee

A GSAP-powered infinite marquee component for smooth, continuous scrolling animations — horizontal and vertical.

## Features

- Infinite seamless loop animation
- **Waits for images to load** before calculating dimensions
- Deferred init — waits until the container enters the viewport (lazy-load friendly)
- Horizontal (`ltr` / `rtl`) and vertical (`ttb` / `btt`) scroll directions
- Adjustable scroll speed
- Optional drag/touch interaction
- Pause on hover option
- Dynamic cloning based on container size (auto add/remove on resize)
- Full TypeScript support
- Programmatic control (pause, resume, destroy)
- Debounced resize handling (150ms)

## Requirements

- Node.js >= 22.0.0
- GSAP >= 3.12.0 (peer dependency)

## Installation

```bash
npm install @refokus-agency/marquee gsap
```

---

## Usage

### HTML Structure

The marquee requires a strict **3-level DOM structure**:

| Level | Role | Description |
|-------|------|-------------|
| Grandparent | **Container** | Clips overflow, provides size for clone calculations |
| Parent | **Track** | Receives the GSAP transform |
| Child | **Wrapper** `[data-marquee]` | Gets cloned to fill the track seamlessly |

#### Horizontal (LTR / RTL)

```html
<div class="marquee-container">
  <div class="marquee-track">
    <div data-marquee class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
      <div data-marquee-item>Item 3</div>
    </div>
    <!-- clones are automatically appended here -->
  </div>
</div>
```

```css
.marquee-container {
  max-width: 100%;
  overflow: hidden;
}

.marquee-track {
  display: flex;
  width: max-content;
}

.marquee-wrapper {
  display: flex;
  flex-shrink: 0;
}

[data-marquee-item] {
  flex-shrink: 0;
}
```

#### Vertical (TTB / BTT)

The container needs a **fixed height**. The track stacks items in a column.

```html
<div class="marquee-container-vertical">
  <div class="marquee-track-vertical">
    <div data-marquee data-marquee-direction="ttb" class="marquee-wrapper-vertical">
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
      <div data-marquee-item>Item 3</div>
    </div>
  </div>
</div>
```

```css
.marquee-container-vertical {
  overflow: hidden;
  height: 400px; /* required — defines the visible window */
}

.marquee-track-vertical {
  display: flex;
  flex-direction: column;
  height: max-content;
}

.marquee-wrapper-vertical {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

[data-marquee-item] {
  flex-shrink: 0;
}
```

---

### Basic Usage

```typescript
import { initMarquee } from '@refokus-agency/marquee';

// Reads direction/speed/draggable/pauseOnHover from data attributes
const marquees = await initMarquee();
```

### With Options

```typescript
import { initMarquee } from '@refokus-agency/marquee';

const marquees = await initMarquee({
  speed: 2,               // Speed multiplier (default: 1)
  direction: 'rtl',       // 'ltr' | 'rtl' | 'ttb' | 'btt' (default: 'ltr')
  draggable: true,        // Enable drag/touch (default: false)
  pauseOnHover: true,     // Pause on hover (default: false)
  dragEase: 0.5,          // Drag easing in seconds (default: 0.5)
});
```

### Custom Selectors

```typescript
const marquees = await initMarquee({
  wrapperSelector: '.my-marquee',
  itemSelector: '.my-item',
});
```

### Using the Marquee Class Directly

```typescript
import { Marquee } from '@refokus-agency/marquee';

const el = document.querySelector('[data-marquee]');

// Recommended: static async factory (waits for images)
const marquee = await Marquee.create(el, {
  speed: 1.5,
  direction: 'ttb',
});

// Alternative: constructor + ready promise
const marquee = new Marquee(el, { speed: 1.5 });
await marquee.ready;

marquee.pause();
marquee.resume();
marquee.setSpeed(2);
marquee.setDirection('btt');
marquee.destroy();
```

### Factory Function

```typescript
import { createMarquee } from '@refokus-agency/marquee';

// By CSS selector
const marquee = await createMarquee('#my-marquee', { speed: 1.5 });

// By element reference
const marquee = await createMarquee(element, { direction: 'ttb' });
```

### Instance Control

```typescript
const [marquee] = await initMarquee();

marquee.pause();
marquee.resume();
marquee.isPaused();       // boolean

marquee.setSpeed(2);
marquee.getSpeed();       // 2

marquee.setDirection('rtl');
marquee.getDirection();   // 'rtl'

marquee.isReady();        // true after images loaded
marquee.isDestroyed();    // false

marquee.destroy();        // removes clones, listeners, resets transform
```

### Data Attributes

Configure each marquee instance directly in HTML — no JS config needed when using `initMarquee()`.

```html
<!-- Vertical top-to-bottom, slow speed, pause on hover -->
<div class="container">
  <div class="track">
    <div
      data-marquee
      data-marquee-direction="ttb"
      data-marquee-speed="0.5"
      data-marquee-pause-on-hover="true"
    >
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
    </div>
  </div>
</div>

<!-- RTL with drag enabled -->
<div class="container">
  <div class="track">
    <div
      data-marquee
      data-marquee-direction="rtl"
      data-marquee-draggable="true"
    >
      <div data-marquee-item>Item A</div>
      <div data-marquee-item>Item B</div>
    </div>
  </div>
</div>
```

**All supported attributes:**

| Attribute | Values | Default |
|-----------|--------|---------|
| `data-marquee` | *(empty — marks the wrapper)* | — |
| `data-marquee-direction` | `ltr` \| `rtl` \| `ttb` \| `btt` | `ltr` |
| `data-marquee-speed` | any number, e.g. `2` | `1` |
| `data-marquee-draggable` | `true` \| `false` | `false` |
| `data-marquee-pause-on-hover` | `true` \| `false` | `false` |

---

## Webflow Setup

### 1 — DOM Structure

Build the 3-level div structure in the Designer:

1. Add a **Div Block** → **Container** (the outermost wrapper)
2. Inside it, add a **Div Block** → **Track**
3. Inside the track, add a **Div Block** → **Wrapper** (this element gets cloned)
4. Inside the wrapper, add your content items (logo images, cards, text, etc.)

### 2 — Custom Attributes

Select the **Wrapper** div, open **Element Settings → Custom Attributes**, and add:

| Attribute | Value |
|-----------|-------|
| `data-marquee` | *(leave value empty)* |
| `data-marquee-direction` | `ltr`, `rtl`, `ttb`, or `btt` |
| `data-marquee-speed` | e.g. `2` |
| `data-marquee-draggable` | `true` or `false` |
| `data-marquee-pause-on-hover` | `true` or `false` |

Only `data-marquee` is required. The others are optional and fall back to defaults.

### 3 — CSS (Horizontal)

In the **Style Panel**, apply these styles to each level:

**Container div**
- Overflow: Hidden

**Track div**
- Display: Flex
- Width: Max Content

**Wrapper div**
- Display: Flex
- Flex Shrink: 0

**Each item inside the wrapper**
- Flex Shrink: 0

### 3 — CSS (Vertical — TTB or BTT)

**Container div**
- Overflow: Hidden
- Height: *(fixed value — e.g. `400px` or `60vh`)*

**Track div**
- Display: Flex
- Flex Direction: Column
- Height: Max Content

**Wrapper div**
- Display: Flex
- Flex Direction: Column
- Flex Shrink: 0

**Each item inside the wrapper**
- Flex Shrink: 0

### 4 — Script Embed

In **Project Settings → Custom Code**, paste before the `</body>` tag:

```html
<!-- GSAP (required peer dependency) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Observer.min.js"></script>

<!-- Marquee init -->
<script>
  window.addEventListener('DOMContentLoaded', async function () {
    const { initMarquee } = await import('URL_TO_YOUR_HOSTED_BUNDLE/marquee.browser.js');
    await initMarquee();
  });
</script>
```

Replace `URL_TO_YOUR_HOSTED_BUNDLE` with the URL where you host the compiled browser bundle (`dist/marquee.browser.js`).

> `initMarquee()` scans the page for `[data-marquee]` elements and reads all configuration from their data attributes automatically.

---

## API Reference

### `MarqueeOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `speed` | `number` | `1` | Animation speed multiplier |
| `direction` | `'ltr' \| 'rtl' \| 'ttb' \| 'btt'` | `'ltr'` | Scroll direction |
| `draggable` | `boolean` | `false` | Enable drag/touch interaction |
| `pauseOnHover` | `boolean` | `false` | Pause animation on hover |
| `dragEase` | `number` | `0.5` | Drag easing duration in seconds |

### `MarqueeConfig` (extends `MarqueeOptions`)

Additional options for `initMarquee()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wrapperSelector` | `string` | `'[data-marquee]'` | Selector for wrapper elements |
| `itemSelector` | `string` | `'[data-marquee-item]'` | Selector for items inside wrapper |
| `directionAttribute` | `string` | `'data-marquee-direction'` | Attribute name for direction |
| `speedAttribute` | `string` | `'data-marquee-speed'` | Attribute name for speed |
| `draggableAttribute` | `string` | `'data-marquee-draggable'` | Attribute name for draggable |
| `pauseOnHoverAttribute` | `string` | `'data-marquee-pause-on-hover'` | Attribute name for pauseOnHover |

### `Marquee` Instance Methods

| Method | Return | Description |
|--------|--------|-------------|
| `pause()` | `void` | Pause the animation |
| `resume()` | `void` | Resume the animation |
| `isPaused()` | `boolean` | Check if paused |
| `isReady()` | `boolean` | True after images loaded and init complete |
| `setSpeed(speed)` | `void` | Update scroll speed |
| `getSpeed()` | `number` | Get current speed |
| `setDirection(dir)` | `void` | Update scroll direction (same axis only) |
| `getDirection()` | `MarqueeDirection` | Get current direction |
| `isDestroyed()` | `boolean` | Check if destroyed |
| `destroy()` | `void` | Clean up clones, listeners, and transforms |

### `Marquee` Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `element` | `HTMLElement` | The wrapper element (readonly) |
| `ready` | `Promise<void>` | Resolves when images loaded and initialized |

### Functions

```typescript
// Initialize all matching elements on the page
initMarquee(config?: MarqueeConfig): Promise<Marquee[]>

// Create a single instance by element or selector
createMarquee(element: HTMLElement | string, options?: MarqueeOptions): Promise<Marquee | null>
```

---

## Development

```bash
pnpm build             # Compile TypeScript + browser bundle
pnpm build:clean       # Clean dist and rebuild
pnpm build:watch       # Vite watch mode
pnpm build:watch:types # TypeScript watch mode
pnpm test              # Run tests
pnpm check-types       # TypeScript type check
pnpm lint              # Lint with Biome (--write)
pnpm format            # Format with Biome (--write)
pnpm commit            # Conventional commit wizard
```

## Publishing

This package uses automated semantic versioning via GitHub Actions. Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
pnpm commit  # Use the commit wizard
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup, commit conventions, and pull request process.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md) code of
conduct. By participating, you are expected to uphold it. Please report
unacceptable behavior to packages@refokus.com.

## License

See [LICENSE](LICENSE) file.
