# @refokus-agency/marquee

[![CI](https://github.com/refokus-agency/marquee/actions/workflows/pr-ci.yml/badge.svg?event=pull_request)](https://github.com/refokus-agency/marquee/actions/workflows/pr-ci.yml)
[![npm version](https://img.shields.io/npm/v/@refokus-agency/marquee.svg)](https://www.npmjs.com/package/@refokus-agency/marquee)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A GSAP-powered infinite marquee component for smooth, continuous scrolling animations — horizontal and vertical.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
  - [ESM only](#esm-only)
- [Installation](#installation)
- [Usage](#usage)
  - [HTML Structure](#html-structure)
  - [Basic Usage](#basic-usage)
  - [With Options](#with-options)
  - [Custom Selectors](#custom-selectors)
  - [Using the Marquee Class Directly](#using-the-marquee-class-directly)
  - [Factory Function](#factory-function)
  - [Instance Control](#instance-control)
  - [Data Attributes](#data-attributes)
- [Webflow Setup](#webflow-setup)
  - [If the page already loads GSAP](#if-the-page-already-loads-gsap)
- [API Reference](#api-reference)
  - [`MarqueeOptions`](#marqueeoptions)
  - [`MarqueeConfig`](#marqueeconfig-extends-marqueeoptions)
  - [`Marquee` Instance Methods](#marquee-instance-methods)
  - [`Marquee` Instance Properties](#marquee-instance-properties)
  - [Functions](#functions)
- [Development](#development)
- [Publishing](#publishing)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [Changelog](#changelog)
- [License](#license)

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
- An ESM environment — see below

### ESM only

This package ships as ES modules and declares no `require` condition, so
`require('@refokus-agency/marquee')` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
Import it instead:

```js
import { initMarquee } from '@refokus-agency/marquee';
```

From CommonJS, use a dynamic import:

```js
const { initMarquee } = await import('@refokus-agency/marquee');
```

## Installation

```bash
# pnpm
pnpm add @refokus-agency/marquee gsap

# npm
npm install @refokus-agency/marquee gsap
```

> Consuming the package works with any package manager. Contributing to it does
> not — the development setup is pnpm-only, see [CONTRIBUTING.md](CONTRIBUTING.md).

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
<script type="module">
  import { initMarquee } from 'https://cdn.jsdelivr.net/npm/@refokus-agency/marquee@X.Y.Z/+esm';

  await initMarquee();
</script>
```

**Replace `@X.Y.Z` with a real version.** Take the current number from the
[latest release](https://github.com/refokus-agency/marquee/releases) or the npm badge at the top
of this page. Use `@X` (e.g. `@1`) instead if you want to track the newest `1.x` automatically and
accept the patch and minor updates that come with it.

No separate GSAP tag is needed: jsDelivr's `/+esm` endpoint resolves the peer dependency and
ships it alongside the package.

> `initMarquee()` scans the page for `[data-marquee]` elements and reads all configuration from their data attributes automatically.

#### If the page already loads GSAP

`/+esm` bundles its own copy of GSAP. On a page that already has one, you pay for **two GSAP
cores** — roughly 70 kB of duplicated payload and a second ticker loop. Marquee still animates
correctly, but it runs on an instance your own code cannot see: shared state such as a global
timeline, `gsap.matchMedia()` contexts, or plugins you registered on the page's core does not
carry across.

To run marquee on the GSAP you already have, load the browser bundle directly and map the `gsap`
specifiers onto the existing global. An import map can only point a specifier at a URL, so the
global is re-exported through a tiny inline shim module:

```html
<!-- The GSAP you already load, in whatever form -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Observer.min.js"></script>

<script type="importmap">
  {
    "imports": {
      "gsap": "data:text/javascript,export const gsap = window.gsap; export default window.gsap;",
      "gsap/dist/Observer": "data:text/javascript,export const Observer = window.Observer; export default window.Observer;"
    }
  }
</script>

<script type="module">
  import { initMarquee } from 'https://cdn.jsdelivr.net/npm/@refokus-agency/marquee@X.Y.Z/dist/marquee.browser.js';

  await initMarquee();
</script>
```

`marquee.browser.js` keeps `gsap` and `gsap/dist/Observer` as bare imports, so the import map
decides what they resolve to — here, the single instance already on `window`. Pointing those keys
at a CDN URL such as `gsap@3/+esm` would *not* achieve this: that fetches a fresh, isolated core
and leaves you back at two instances.

Replace `@X.Y.Z` here as well. This path requires a release that ships
`dist/marquee.browser.js` — it does not exist in versions published before that bundle was added,
so pin at or above the first release containing it rather than reusing an older number.

`docs/examples/local/index.html` in this repository is a working version of this setup, using
separate shim files instead of inline `data:` URLs.

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
pnpm build             # Compile TypeScript + browser bundle, then validate the package
pnpm build:clean       # Clean dist and rebuild
pnpm build:watch       # Vite watch mode (no validation)
pnpm build:watch:types # TypeScript watch mode
pnpm test              # Run tests
pnpm check-types       # TypeScript type check
pnpm lint              # Lint with Biome (--write)
pnpm format            # Format with Biome (--write)
pnpm validate:package  # Entry-point rules + publint + attw (runs as part of build)
pnpm commit            # Conventional commit wizard
```

`build` ends with `validate:package`, which asserts the entry-point shape
(`scripts/validate-exports.mjs`), then runs `publint` and
`attw --pack --profile esm-only` against a real tarball. A packaging mistake fails the build
rather than reaching npm. `build:watch` skips it, so iteration stays fast.

## Publishing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/)
and commits must follow
[Conventional Commits](https://www.conventionalcommits.org/) — the version
number is derived from the commit history.

Published versions are available on npm as
[`@refokus-agency/marquee`](https://www.npmjs.com/package/@refokus-agency/marquee).

`prepublishOnly` runs `check-types`, `lint` and `build:clean` before npm accepts the tarball, so
`validate:package` executes a second time at publish — once in CI and once against the exact
artifact being uploaded. The repeated work is deliberate: it is the last gate before a broken
entry-point map becomes a published version.

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

## Security

To report a vulnerability, follow the process described in
[SECURITY.md](SECURITY.md) — please do not open a public issue for security
reports.

## Changelog

Release notes for every version are published on the
[GitHub Releases page](https://github.com/refokus-agency/marquee/releases).

## License

Licensed under the Apache License, Version 2.0 (`Apache-2.0`). See
[LICENSE](LICENSE) for the full license text and [NOTICE](NOTICE) for
attribution requirements.
