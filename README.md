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

### Custom Selector

```typescript
const marquees = await initMarquee({
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
const [marquee] = await initMarquee();

marquee.pause();          // deliberate — hover and focus cannot lift it
marquee.resume();         // deliberate — outranks a hover or focus pause
marquee.isPaused();       // boolean — true for any cause, transient ones included

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
| `data-marquee-pause-on-focus` | `true` \| `false` | `false` |
| `data-marquee-pause-button-enabled` | `true` \| `false` | `true` |
| `data-marquee-respect-reduced-motion` | `true` \| `false` | `true` |

`data-marquee-pause-button` goes on the button itself, not the wrapper — see
[Pause Button](#pause-button).

---

## Accessibility

### Reduced Motion

By default the marquee honors the operating system's reduced-motion setting. While
`(prefers-reduced-motion: reduce)` matches, the marquee:

- stops advancing and resets to its start position
- sets `overflow-x: auto` on the **container** (or `overflow-y` for `ttb` / `btt`) so the content
  stays reachable by native scrolling
- kills the drag interaction, if `draggable` was enabled
- reports `isPaused() === true`, and ignores `resume()` — the preference outranks it, so nothing
  moves until the preference itself changes

The scroll affordance matters: a frozen marquee that still clips its overflow would hide every item
past the container edge with no way to reach them. Native scrolling replaces the animation as the
mechanism for getting to that content — which is also why drag is dropped rather than kept. Drag
and native scroll compete for the same gesture on the same axis, and on touch they fight outright,
so the one that guarantees reachability wins.

This is the only style the library writes on an element you own. Whatever inline `overflow-x` /
`overflow-y` the container already had is recorded and restored verbatim when the preference turns
off or the instance is destroyed. Nothing else on the container is read or written — including its
scroll offsets, which are only ever reset on the axis the library itself made scrollable.

On platforms with classic scrollbars (Windows), the scrollbar appearing can shift the layout around
the marquee. Reserve the space if that matters to you:

```css
.marquee-container {
  scrollbar-gutter: stable;
}
```

The preference is watched live, not read once: flipping it at the OS level freezes or resumes an
already-running marquee.

To animate regardless of the preference, opt out:

```typescript
// Per instance
const marquee = await createMarquee('#my-marquee', { respectReducedMotion: false });

// Or for every marquee on the page
await initMarquee({ respectReducedMotion: false });
```

```html
<!-- Or per element, with initMarquee() -->
<div data-marquee data-marquee-respect-reduced-motion="false">…</div>
```

> `respectReducedMotion: false` opts out of **honoring** the preference, not out of detecting it.
> Setting it to `false` means "animate anyway", so use it only where motion is essential to what
> the content communicates.

Browsers that cannot report the preference at all animate normally, as does any environment without
`window.matchMedia`.

#### Known limitations

The live watching runs on `gsap.matchMedia()`, which brings two GSAP behaviors with it. Neither is
specific to this library — they affect every `gsap.matchMedia()` consumer — but both are worth
knowing about.

**Two preference changes less than 2ms apart: the second is dropped.** GSAP coalesces media-change
events into one pass every 2ms, shared across every `gsap.matchMedia()` user on the page. That coalescing is what keeps
one preference change from being processed once per registered query, but it cannot tell duplicate
events apart from two genuinely different values. When the second value is dropped, GSAP's record of
the preference does not advance either, so the marquee can stay out of sync with the real setting
until the next media change anywhere on the page resynchronizes it.

In practice this is a testing concern, not a user-facing one: the first change after page load is
always applied, and nobody can toggle an OS setting twice within 2ms. What *can* is an automated
suite driving the preference through something like Playwright's `emulateMediaFeatures()`. **If you
assert reduced-motion behavior in tests, leave more than 2ms between flips** — otherwise a pass or a
failure may be measuring the dropped event rather than the marquee.

**The native media-query listener outlives `destroy()`.** `destroy()` releases the
`gsap.matchMedia()` context, but GSAP never calls `removeListener` on the underlying
`MediaQueryList`, and exposes no API to do it. The destroyed instance is still garbage-collectible —
GSAP's handler is a module-level function holding no per-instance state — but the native listener
count grows across mount/unmount cycles in SPA-style usage.

### Pause Button

A pause button is the mechanism WCAG [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
is really asking for. [Reduced Motion](#reduced-motion) already covers conformance, but it lives in
an OS setting most people never find — the button is the part a reader can actually see and press.

The markup is yours. The library never injects a button and never styles one; it binds the button
you put in the container:

```html
<div class="marquee-container">
  <div class="marquee-track">
    <div data-marquee class="marquee-wrapper">
      <div data-marquee-item>Item 1</div>
    </div>
    <!-- clones are automatically appended here -->
  </div>

  <!-- Inside the container, OUTSIDE the track -->
  <button type="button" data-marquee-pause-button>
    <span data-when="running">Pause</span>
    <span data-when="paused">Play</span>
  </button>
</div>
```

**The button has to sit outside the track.** The wrapper is cloned to fill the track, so a button
placed in there would be duplicated into every clone — and clones are marked `aria-hidden` with
`tabindex="-1"`, so most of the copies are unreachable anyway. A button found inside the track is
refused, with a warning saying so.

Use a real `<button>`. Any element matching the selector gets bound, but only a button comes with
keyboard operability and the right role, and the library cannot supply either — so a match that is
neither a `<button>` nor `role="button"` is bound *and* warned about. A pause control only mouse
users can operate does not satisfy the criterion it exists for.

The lookup is scoped to each instance's own container, so a page full of marquees never has one
binding another's control.

#### State and labelling

Every press toggles the marquee, and the library mirrors the result onto the button as
`data-marquee-paused="true" | "false"`. It writes state, never content — rewriting your text would
clobber your copy and your translations — so the attribute is the hook for swapping the label
yourself:

```css
[data-marquee-pause-button] [data-when='paused'],
[data-marquee-pause-button][data-marquee-paused='true'] [data-when='running'] {
  display: none;
}

[data-marquee-pause-button][data-marquee-paused='true'] [data-when='paused'] {
  display: revert;
}
```

Two real elements rather than `::after` generated content, so the button keeps an accessible name
if your CSS is overridden or never loads. Swapping which one is `display: none` swaps the button's
accessible name with it, which is the [APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)'s
approach.

The library does **not** write `aria-pressed`. That attribute is only valid on something with button
semantics, and `pauseButtonSelector` can match any element — so writing it risks an
`aria-allowed-attr` violation in your page, introduced by an accessibility feature. It would also
double-signal against the label swap above: a control whose text already reads "Play" does not also
need to announce "pressed".

The attribute tracks the **effective** state, hover and focus pauses included. A marquee sitting
still with its control still reading "Pause" would be the label lying about the marquee.

#### Explicit intent outranks hover and focus

A press is a standing decision, and it beats the transient hover and focus pauses in both
directions.

**Pausing holds.** Leaving hover or moving focus out never resumes a marquee the reader stopped on
purpose — a mechanism another gesture can silently undo is not a mechanism.

**Resuming holds too, and this is not symmetric politeness.** The button lives inside the container,
so under `pauseOnHover` the pointer is *always* on the marquee at the moment of the press. If a
press only cleared its own flag, the hover pause would immediately re-assert and the control would be
permanently dead in that configuration. So an explicit resume outranks hover and focus rather than
clearing them, and retires itself once the pointer leaves and focus moves out — after which the next
hover or tab-in pauses normally again.

The upshot for `isPaused()`: it reports whether the marquee is moving, from any cause — an explicit
pause, a hover or focus pause, or reduced motion.

#### Under reduced motion the button is hidden

While reduced motion is applied the marquee cannot move and `isPaused()` already reports `true`, so
the button has nothing to control and is hidden with an inline `display: none`. Hiding follows the
**applied** state, not the OS preference: with `respectReducedMotion: false` the marquee moves and
the button stays. Whatever inline `display` the button already had is recorded and restored verbatim
when the preference turns off or the instance is destroyed, along with any `data-marquee-paused` it
carried before the library touched it.

#### Opting out

With no button in the container, the library warns — unconditionally, on every environment,
including production. There is no environment detection in this package, and adding a
`process.env.NODE_ENV` guard would throw `ReferenceError: process is not defined` on the CDN path
this README documents. For a marquee that deliberately ships no button, say so and the warning goes
away:

```typescript
await initMarquee({ pauseButton: false });
```

```html
<!-- Or per element, with initMarquee() -->
<div data-marquee data-marquee-pause-button-enabled="false">…</div>
```

Or point the library at your own selector instead of the marker attribute:

```typescript
await initMarquee({ pauseButtonSelector: '.my-marquee-stop' });
```

An invalid selector is warned about and treated as "no button" — it never takes the marquee itself
down with it.

### Pause on Focus

`pauseOnFocus` is the keyboard counterpart to `pauseOnHover`: while focus sits inside the container
the marquee holds still, so a reader tabbing through its links is not chasing a moving target.

```typescript
await initMarquee({ pauseOnFocus: true });
```

```html
<div data-marquee data-marquee-pause-on-focus="true">…</div>
```

The pause button counts as inside the container, because it is. Tabbing from a link towards the
control therefore does not restart the marquee under the reader's hands; the press that follows
resumes it, since the button toggles against what the marquee is doing rather than against its own
press history.

Two things limit how far this reaches on its own, which is why it is not a substitute for the
button. A running marquee's container is `overflow: hidden` and not a scroll container, so it is not
focusable itself: if your items carry no links or buttons, there is nothing inside to focus. And
neither focus nor hover helps a touch user, or assistive technology driven in a mode that moves
neither.

`pauseOnHover` and `pauseOnFocus` both stay `false` by default. Flipping either one does not get you
2.2.2 — with a button, the button is the conforming mechanism; without one, hover and focus miss
exactly the users who need the mechanism most.

### Clones and the Accessibility Tree

The marquee fills the track by cloning its wrapper. Every clone gets `aria-hidden="true"`, and every
focusable element inside it gets `tabindex="-1"` — otherwise a screen reader would announce each item
several times over, and every cloned link would become a duplicate tab stop.

Both go on every clone the marquee creates, independent of `respectReducedMotion` and of the motion
preference. **Anything focusable inside a marquee is reachable by keyboard and by assistive
technology exactly once**, in the original wrapper. Clones stay fully clickable, so a reader can
activate whichever copy of a link happens to be under the pointer.

That last part is why `inert` is not used, despite covering both exclusions in a single attribute.
`inert` also blocks hit-testing, and the track only ever translates by one period — so the original
wrapper occupies at most its own width of the container, and most of what the reader sees at any
moment is a clone. Under `inert` the majority of a marquee's links would silently stop responding to
clicks, which reads as a broken site rather than a library limitation. `aria-hidden` and `tabindex`
also work in every browser, where `inert` needs Chrome 102+, Safari 15.5+ or Firefox 112+ to do
anything at all.

The tradeoff this leaves: a pointer can still move focus into an `aria-hidden` subtree, so an
accessibility audit will flag `aria-hidden-focus` as needs-review rather than passing clean. Mouse
users who click a cloned link navigate immediately, and keyboard and screen-reader users never reach
one, so the flag is expected here.

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
| `itemSelector` | `string` | `'[data-marquee-item]'` | **Deprecated** — has no effect and is ignored. Kept for backward compatibility; will be removed in `2.0.0` ([#67](https://github.com/refokus-agency/marquee/issues/67)) |
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
| `pause()` | `void` | Pause deliberately — hover and focus cannot lift it, see [Pause Button](#explicit-intent-outranks-hover-and-focus) |
| `resume()` | `void` | Resume deliberately — outranks a hover or focus pause until the pointer leaves and focus moves out; no effect while reduced motion is active, see [Reduced Motion](#reduced-motion) |
| `isPaused()` | `boolean` | Check if paused — `true` for an explicit, hover, or focus pause, and while reduced motion is active |
| `isReady()` | `boolean` | True after images loaded and init complete |
| `setSpeed(speed)` | `void` | Update scroll speed |
| `getSpeed()` | `number` | Get current speed |
| `setDirection(dir)` | `void` | Update scroll direction — **same axis only** (`ltr` ↔ `rtl`, `ttb` ↔ `btt`). Crossing axes is not supported |
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
