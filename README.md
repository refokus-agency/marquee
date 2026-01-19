# @refokus-agency/marquee

A GSAP-powered infinite marquee/carousel component for smooth, continuous scrolling animations with drag interaction support.

## Features

- Infinite seamless loop animation
- Dynamic cloning based on container width (auto add/remove on resize)
- Configurable scroll direction (LTR/RTL)
- Adjustable scroll speed
- Drag/touch interaction support
- Pause on hover option
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

## Usage

### HTML Setup

The marquee requires a **3-level structure**:

1. **Container** (grandparent): `overflow: hidden`, `max-width: 100%` - clips content and provides width for calculations
2. **Track** (parent): `display: flex`, `width: max-content` - receives the transform animation
3. **Wrapper** `[data-marquee]`: gets cloned to fill the track seamlessly

```html
<!-- Container: overflow hidden, used for width calculation -->
<div class="marquee-container">
  <!-- Track: gets the transform applied -->
  <div class="marquee-track">
    <!-- Wrapper: gets cloned to fill the track -->
    <div data-marquee class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
      <div data-marquee-item>Item 3</div>
    </div>
    <!-- Clones are automatically appended here as siblings -->
  </div>
</div>
```

Add the required CSS:

```css
/* Container - clips overflow and defines visible width */
.marquee-container {
  max-width: 100%;
  overflow: hidden;
}

/* Track - flex container that receives transform */
.marquee-track {
  display: flex;
  width: max-content;
}

/* Wrapper - gets cloned, must not shrink */
.marquee-wrapper {
  display: flex;
  flex-shrink: 0;
}

/* Items - must not shrink */
[data-marquee-item] {
  flex-shrink: 0;
}
```

### Basic Usage

```typescript
import { initMarquee } from '@refokus-agency/marquee';

// Initialize all marquees on the page
const marquees = initMarquee();
```

### With Configuration

```typescript
import { initMarquee } from '@refokus-agency/marquee';

const marquees = initMarquee({
  speed: 2,              // Scroll speed multiplier (default: 1)
  direction: 'rtl',      // Scroll direction: 'ltr' or 'rtl' (default: 'ltr')
  draggable: true,       // Enable drag interaction (default: true)
  pauseOnHover: true,    // Pause when mouse hovers (default: false)
  dragEase: 0.5,         // Drag easing duration in seconds (default: 0.5)
});
```

### Custom Selectors

```typescript
const marquees = initMarquee({
  wrapperSelector: '.my-carousel',
  itemSelector: '.carousel-item',
});
```

### Single Element

```typescript
import { createMarquee } from '@refokus-agency/marquee';

// By selector
const marquee = createMarquee('#my-marquee', {
  speed: 1.5,
  pauseOnHover: true,
});

// By element reference
const element = document.querySelector('.marquee');
const marquee = createMarquee(element, { speed: 2 });
```

### Instance Control

```typescript
const [marquee] = initMarquee();

// Pause/resume
marquee.pause();
marquee.resume();
marquee.isPaused(); // boolean

// Update settings
marquee.setSpeed(2);
marquee.setDirection('rtl');

// Cleanup
marquee.destroy();
```

### Data Attributes

You can also configure individual marquees via HTML attributes:

```html
<!-- RTL direction with speed of 2 -->
<div class="marquee-container">
  <div class="marquee-track">
    <div data-marquee data-marquee-direction="rtl" data-marquee-speed="2" class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
      <div data-marquee-item>Item 2</div>
    </div>
  </div>
</div>
```

### Responsive Cloning

The component automatically:
- Calculates how many clones are needed based on container width
- Adds/removes clones on window resize (debounced at 150ms)
- Creates seamless infinite loops by cloning the entire wrapper element

## API Reference

### `initMarquee(config?): MarqueeInstance[]`

Initialize marquees on all matching elements.

#### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wrapperSelector` | `string` | `'[data-marquee]'` | Selector for wrapper elements |
| `itemSelector` | `string` | `'[data-marquee-item]'` | Selector for items inside wrapper |
| `speed` | `number` | `1` | Animation speed multiplier |
| `direction` | `'ltr' \| 'rtl'` | `'ltr'` | Scroll direction |
| `draggable` | `boolean` | `true` | Enable drag/touch interaction |
| `pauseOnHover` | `boolean` | `false` | Pause animation on hover |
| `dragEase` | `number` | `0.5` | Drag easing duration (seconds) |
| `directionAttribute` | `string` | `'data-marquee-direction'` | Attribute for direction |
| `speedAttribute` | `string` | `'data-marquee-speed'` | Attribute for speed |

### `createMarquee(element, options?): MarqueeInstance | null`

Create a marquee on a single element.

### `MarqueeInstance`

| Method | Description |
|--------|-------------|
| `pause()` | Pause the animation |
| `resume()` | Resume the animation |
| `isPaused()` | Check if paused |
| `setSpeed(speed)` | Update scroll speed |
| `setDirection(dir)` | Update scroll direction |
| `destroy()` | Clean up and remove |
| `element` | The wrapper HTMLElement |

## Development

### Available Scripts

```bash
npm run build          # Compile TypeScript
npm run build:clean    # Clean and rebuild
npm run build:watch    # Watch mode
npm test               # Run tests
npm run lint           # Lint code
npm run format         # Format code
npm run commit         # Conventional commit wizard
```

## Publishing

This package uses automated semantic versioning via GitHub Actions. Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
npm run commit  # Use the commit wizard
```

## License

See [LICENSE](LICENSE) file.
