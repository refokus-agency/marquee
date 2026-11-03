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
  - [Custom Selector](#custom-selector)
  - [Using the Marquee Class Directly](#using-the-marquee-class-directly)
  - [Factory Function](#factory-function)
  - [Instance Control](#instance-control)
  - [Changing direction](#changing-direction)
    - [Unsupported values](#unsupported-values)
  - [Data Attributes](#data-attributes)
- [Accessibility](#accessibility)
  - [Reduced Motion](#reduced-motion)
  - [Pause Button](#pause-button)
  - [Pause on Focus](#pause-on-focus)
  - [Clones and the Accessibility Tree](#clones-and-the-accessibility-tree)
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
- Pause on hover and pause on focus options
- Binds **your** pause button — a visible WCAG 2.2.2 mechanism, no CSS shipped
- Honors `prefers-reduced-motion` — freezes and becomes scrollable instead
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
const marquees = initMarquee();
```

`initMarquee()` returns the instances **synchronously**. Each marquee lazy-initializes
when its container enters the viewport, so it is not ready yet. Await only the ones
you need:

```typescript
await marquees[0]?.ready; // resolves once that marquee has been seen and measured
marquees[0]?.pause();
```

Do not `await Promise.all(marquees.map(m => m.ready))` on a long page: it waits for
every marquee to be scrolled into view.

### Tearing Down

Call `destroy()` on any instance at any time, including marquees that never entered
the viewport. A destroyed marquee will not initialize if it scrolls into view later.

```typescript
const marquees = initMarquee();
// e.g. when an SPA view unmounts
marquees.forEach((m) => m.destroy());
```

### With Options

```typescript
import { initMarquee } from '@refokus-agency/marquee';

const marquees = initMarquee({
  speed: 2,               // Speed multiplier (default: 1)
  direction: 'rtl',       // 'ltr' | 'rtl' | 'ttb' | 'btt' (default: 'ltr')
  draggable: true,        // Enable drag/touch (default: false)
  pauseOnHover: true,     // Pause on hover (default: false)
  dragEase: 0.5,          // Drag easing in seconds (default: 0.5)
});
```

### Custom Selector

```typescript
const marquees = initMarquee({
  wrapperSelector: '.my-marquee',
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
const [marquee] = initMarquee();
await marquee.ready;

marquee.pause();          // deliberate — hover and focus cannot lift it
marquee.resume();         // deliberate — outranks a hover or focus pause
marquee.isPaused();       // boolean — true for any cause, transient ones included

marquee.setSpeed(2);
marquee.getSpeed();       // 2

marquee.setDirection('rtl');
marquee.getDirection();   // 'rtl' — same axis, applied

marquee.isReady();        // true after images loaded
marquee.isDestroyed();    // false

marquee.destroy();        // removes clones, listeners, resets transform
```

### Changing direction

`setDirection()` changes direction **within the axis the instance was built on**:

```typescript
marquee.setDirection('rtl');   // from 'ltr' — fine
marquee.setDirection('btt');   // from 'ttb' — fine
```

Crossing axes on a **running** marquee is not supported. The call warns and
leaves the instance untouched:

```typescript
const marquee = await Marquee.create(el, { direction: 'ltr' });

marquee.setDirection('ttb');
// > Marquee: setDirection('ttb') crosses axes from 'ltr' and was ignored. …

marquee.getDirection();   // still 'ltr'
```

The reason is that a vertical marquee is not just a different sign on the same
animation — it needs different CSS. `flex-direction: column` and
`height: max-content` on the track and wrapper live in **your** stylesheet
(see [Vertical (TTB / BTT)](#vertical-ttb--btt)), and the library never writes
them. A setter that flipped the JS side alone would animate the wrong axis of a
layout that is still a row.

To switch axes, recreate the instance alongside the layout change:

```typescript
let marquee = await Marquee.create(wrapper, { direction: 'ltr' });

// …later, when the layout switches to vertical
marquee.destroy();

track.className = 'marquee-track-vertical';
wrapper.className = 'marquee-wrapper-vertical';

marquee = await Marquee.create(wrapper, { direction: 'ttb' });
```

For a responsive marquee that is horizontal on desktop and vertical on mobile,
do this from a `gsap.matchMedia()` breakpoint so the swap is tied to the same
media query as the CSS.

One exception: **before `ready` resolves**, a cross-axis change is honored.
Nothing has been measured at that point, so the direction is simply read when
the measuring happens:

```typescript
const marquee = new Marquee(el);   // initializes asynchronously
if (isMobile) marquee.setDirection('ttb');
await marquee.ready;               // measures on height, animates y
```

Passing `direction` to the constructor is clearer, but this path works and is
not rejected.

#### Unsupported values

The four directions are **case-sensitive**, and `MarqueeDirection` only checks
at compile time — a script embed or a `data-marquee-direction` typo reaches the
library as a raw string. Both are validated at runtime.

An unsupported value at construction warns and falls back to the documented
`ltr` default:

```html
<div data-marquee data-marquee-direction="TTB">…</div>
```

```text
Marquee: unsupported direction "TTB". Expected one of ltr, rtl, ttb, btt —
falling back to 'ltr'.
```

The marquee then runs as `ltr` and `getDirection()` reports `'ltr'`, not the
typo.

`setDirection()` does **not** default an unsupported value — it warns and keeps
the direction it has:

```typescript
marquee.setDirection('TTB' as MarqueeDirection);
// > Marquee: setDirection("TTB") is not one of ltr, rtl, ttb, btt and was
//   ignored. The direction is still 'ttb'.
```

Falling back to `ltr` there would switch a running vertical marquee onto an
axis its layout has no CSS for — the same failure the axis rule above prevents.
A typo is not a request to change axis.

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
| `data-marquee-direction` | `ltr` \| `rtl` \| `ttb` \| `btt` | `ltr` (anything else warns and falls back) |
| `data-marquee-speed` | any number, e.g. `2` | `1` |
| `data-marquee-draggable` | `true` \| `false` | `false` |
| `data-marquee-pause-on-hover` | `true` \| `false` | `false` |
| `data-marquee-pause-on-focus` | `true` \| `false` | `false` |
| `data-marquee-pause-button-enabled` | `true` \| `false` | `true` |
| `data-marquee-respect-reduced-motion` | `true` \| `false` | `true` |

`data-marquee-pause-button` goes on the button itself, not the wrapper — see
[Pause Button](#pause-button).

---

## Accessibility

The marquee is accessible by default in two ways, and accepts one piece of markup from you for the
third. Full reasoning, edge cases and audit notes live in **[docs/accessibility.md](docs/accessibility.md)**.

| Behaviour | Default | Needs markup from you |
|---|---|---|
| Honors `prefers-reduced-motion` | on | no |
| Clones excluded from the a11y tree and tab order | always | no |
| Pause button bound, when present | on | **yes** |
| Pause on hover / on focus | off | no |

### Reduced Motion

While `(prefers-reduced-motion: reduce)` matches, the marquee freezes at its start position and the
container becomes natively scrollable so the content stays reachable. Drag is dropped, `isPaused()`
reports `true`, and the preference is watched live. With no focusable content inside, the container also becomes a keyboard
focus stop (`tabindex="0"`, plus `role="region"` when it is already labelled). The container's
inline overflow, `tabindex` and `role` are recorded and restored verbatim afterwards.

```typescript
initMarquee({ respectReducedMotion: false }); // animate regardless
```

→ [Details, opt-out forms, and two `gsap.matchMedia()` caveats](docs/accessibility.md#reduced-motion)

### Pause Button

Reduced motion covers [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
conformance, but it lives in an OS setting most people never find. The button is the part a reader
can see and press. **You supply it; the library binds it and ships no CSS for it.**

Put a real `<button>` inside the container, as a **sibling of the track** — the wrapper is cloned,
so a button inside the track would be duplicated into every clone:

```html
<div class="marquee-container">
  <div class="marquee-track">
    <div data-marquee class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
    </div>
  </div>

  <button type="button" data-marquee-pause-button>
    <span data-when="running">Pause</span>
    <span data-when="paused">Play</span>
  </button>
</div>
```

The library mirrors state onto it as `data-marquee-paused="true" | "false"` — never your content —
so you swap the label yourself:

```css
[data-marquee-pause-button] [data-when='paused'],
[data-marquee-pause-button][data-marquee-paused='true'] [data-when='running'] {
  display: none;
}

[data-marquee-pause-button][data-marquee-paused='true'] [data-when='paused'] {
  display: revert;
}
```

With no button in the container the library warns. Opt out with `pauseButton: false`, or point it at
your own selector with `pauseButtonSelector`.

→ [Why `data-marquee-paused` and not `aria-pressed`, how a press outranks hover and focus, and what
happens under reduced motion](docs/accessibility.md#the-pause-button)

### Pause on Focus

`pauseOnFocus` is the keyboard counterpart to `pauseOnHover`: while focus sits inside the container
the marquee holds still, so a reader tabbing through its links is not chasing a moving target. Both
stay `false` by default — neither gets you 2.2.2 on its own, since neither helps a touch user.

```typescript
initMarquee({ pauseOnFocus: true });
```

→ [Details and limits](docs/accessibility.md#pause-on-focus)

### Clones and the Accessibility Tree

Every clone gets `aria-hidden="true"` and its focusable children get `tabindex="-1"`, so anything
focusable inside a marquee is reachable by keyboard and assistive technology **exactly once**.
Clones stay clickable.

→ [Why not `inert`, and the one audit flag to expect](docs/accessibility.md#clones-and-the-accessibility-tree)

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
| `data-marquee-direction` | `ltr`, `rtl`, `ttb`, or `btt` — case-sensitive |
| `data-marquee-speed` | e.g. `2` |
| `data-marquee-draggable` | `true` or `false` |
| `data-marquee-pause-on-hover` | `true` or `false` |
| `data-marquee-pause-on-focus` | `true` or `false` |

Only `data-marquee` is required. The others are optional and fall back to defaults.

Then add the pause button: place a **Button** inside the **Container**, as a sibling of the track
(not inside the wrapper — that div gets cloned), and give it the custom attribute
`data-marquee-pause-button` with an empty value. Without one, the library logs a warning; see
[Pause Button](#pause-button).

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

  initMarquee();
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

[Reduced motion](#reduced-motion) is unaffected by this: marquee's own `gsap.matchMedia()` context
only runs callbacks — it never creates tweens — so it works on whichever core the package imported.

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

  initMarquee();
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
| `pauseOnFocus` | `boolean` | `false` | Pause while focus is inside the container — see [Pause on Focus](#pause-on-focus) |
| `pauseButton` | `boolean` | `true` | Bind a pause button from the container, and warn when none is there — see [Pause Button](#pause-button) |
| `pauseButtonSelector` | `string` | `'[data-marquee-pause-button]'` | Selector for the pause button, resolved against the container |
| `dragEase` | `number` | `0.5` | Drag easing duration in seconds |
| `respectReducedMotion` | `boolean` | `true` | Honor `prefers-reduced-motion` — see [Reduced Motion](#reduced-motion) |

### `MarqueeConfig` (extends `MarqueeOptions`)

Additional options for `initMarquee()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wrapperSelector` | `string` | `'[data-marquee]'` | Selector for wrapper elements |
| `directionAttribute` | `string` | `'data-marquee-direction'` | Attribute name for direction |
| `speedAttribute` | `string` | `'data-marquee-speed'` | Attribute name for speed |
| `draggableAttribute` | `string` | `'data-marquee-draggable'` | Attribute name for draggable |
| `pauseOnHoverAttribute` | `string` | `'data-marquee-pause-on-hover'` | Attribute name for pauseOnHover |
| `pauseOnFocusAttribute` | `string` | `'data-marquee-pause-on-focus'` | Attribute name for pauseOnFocus |
| `pauseButtonAttribute` | `string` | `'data-marquee-pause-button-enabled'` | Attribute name for pauseButton |
| `respectReducedMotionAttribute` | `string` | `'data-marquee-respect-reduced-motion'` | Attribute name for respectReducedMotion |

### `Marquee` Instance Methods

| Method | Return | Description |
|--------|--------|-------------|
| `pause()` | `void` | Pause deliberately — hover and focus cannot lift it, see [Explicit intent](docs/accessibility.md#explicit-intent-outranks-hover-and-focus) |
| `resume()` | `void` | Resume deliberately — outranks a hover or focus pause until the pointer leaves and focus moves out; no effect while reduced motion is active, see [Reduced Motion](#reduced-motion) |
| `isPaused()` | `boolean` | Check if paused — `true` for an explicit, hover, or focus pause, and while reduced motion is active |
| `isReady()` | `boolean` | True after images loaded and init complete |
| `setSpeed(speed)` | `void` | Update scroll speed |
| `getSpeed()` | `number` | Get current speed |
| `setDirection(dir)` | `void` | Update scroll direction — **same axis only** (`ltr` ↔ `rtl`, `ttb` ↔ `btt`). A cross-axis call warns and is ignored, see [Changing direction](#changing-direction) |
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
// Returns synchronously; await `marquee.ready` per instance as needed
initMarquee(config?: MarqueeConfig): Marquee[]

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
pnpm typecheck         # TypeScript type check
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

`prepublishOnly` runs `typecheck`, `lint` and `build:clean` before npm accepts the tarball, so
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
