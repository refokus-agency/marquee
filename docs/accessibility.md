# Accessibility

Reference for the marquee's accessibility behaviour: what it does on its own, what it needs from
you, and why each decision went the way it did.

The [README](../README.md#accessibility) covers what you need to use the library. This document is
for when you need to know *why* — reviewing an audit finding, debugging a control that behaves
unexpectedly, or deciding whether a default is right for your site.

## Contents

- [What you get by default](#what-you-get-by-default)
- [Reduced motion](#reduced-motion)
  - [Opting out](#opting-out-of-reduced-motion)
  - [Known limitations](#known-limitations)
- [The pause button](#the-pause-button)
  - [Where it goes](#where-it-goes)
  - [State and labelling](#state-and-labelling)
  - [Explicit intent outranks hover and focus](#explicit-intent-outranks-hover-and-focus)
  - [Under reduced motion the button is hidden](#under-reduced-motion-the-button-is-hidden)
  - [Opting out and diagnostics](#opting-out-and-diagnostics)
- [Pause on focus](#pause-on-focus)
- [Clones and the accessibility tree](#clones-and-the-accessibility-tree)

## What you get by default

| Behaviour | Default | Needs markup from you |
|---|---|---|
| Honors `prefers-reduced-motion` | on | no |
| Clones excluded from the a11y tree and tab order | always | no |
| Pause button bound, when present | on | **yes** — you supply the `<button>` |
| Pause on hover | off | no |
| Pause on focus | off | no |

Only the pause button needs anything from you, and it is the one that does the most for
[WCAG 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

## Reduced motion

While `(prefers-reduced-motion: reduce)` matches, the marquee:

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

Keyboard users need to be able to focus a scroll container to scroll it, and not every browser does
that by default (Safari). So when the marquee holds no focusable content, the container also gets:

- `tabindex="0"`, unless you already set a `tabindex`
- `role="region"`, only if the container already has an `aria-label` / `aria-labelledby` and no
  `role` — an unnamed region is worse than none, so give the container a label to get it

If the marquee contains links or buttons, nothing is added: tabbing to them already scrolls the
content into view, and a container stop would just be a redundant tab stop.

These are the only things the library writes on an element you own. Whatever inline `overflow-x` /
`overflow-y`, `tabindex` and `role` the container already had is recorded and restored verbatim when
the preference turns off or the instance is destroyed. Nothing else on the container is read or
written — including its scroll offsets, which are only ever reset on the axis the library itself made
scrollable.

On platforms with classic scrollbars (Windows), the scrollbar appearing can shift the layout around
the marquee. Reserve the space if that matters to you:

```css
.marquee-container {
  scrollbar-gutter: stable;
}
```

The preference is watched live, not read once: flipping it at the OS level freezes or resumes an
already-running marquee.

Browsers that cannot report the preference at all animate normally, as does any environment without
`window.matchMedia`.

### Opting out of reduced motion

```typescript
// Per instance
const marquee = await createMarquee('#my-marquee', { respectReducedMotion: false });

// Or for every marquee on the page
initMarquee({ respectReducedMotion: false });
```

```html
<!-- Or per element, with initMarquee() -->
<div data-marquee data-marquee-respect-reduced-motion="false">…</div>
```

> `respectReducedMotion: false` opts out of **honoring** the preference, not out of detecting it.
> Setting it to `false` means "animate anyway", so use it only where motion is essential to what
> the content communicates.

### Known limitations

The live watching runs on `gsap.matchMedia()`, which brings two GSAP behaviors with it. Neither is
specific to this library — they affect every `gsap.matchMedia()` consumer — but both are worth
knowing about.

**Two preference changes less than 2ms apart: the second is dropped.** GSAP coalesces media-change
events into one pass every 2ms, shared across every `gsap.matchMedia()` user on the page. That
coalescing is what keeps one preference change from being processed once per registered query, but
it cannot tell duplicate events apart from two genuinely different values. When the second value is
dropped, GSAP's record of the preference does not advance either, so the marquee can stay out of
sync with the real setting until the next media change anywhere on the page resynchronizes it.

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

## The pause button

A pause button is the mechanism WCAG 2.2.2 is really asking for. [Reduced motion](#reduced-motion)
already covers conformance, but it lives in an OS setting most people never find — the button is the
part a reader can actually see and press.

The markup is yours. The library never injects a button and never styles one; it binds the button
you put in the container.

### Where it goes

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

### State and labelling

Every press toggles the marquee, and the library mirrors the result onto the button as
`data-marquee-paused="true" | "false"`. It writes state, never content — rewriting your text would
clobber your copy and your translations — so the attribute is the hook for swapping the label
yourself.

Two real elements rather than `::after` generated content, so the button keeps an accessible name
if your CSS is overridden or never loads. Swapping which one is `display: none` swaps the button's
accessible name with it, which is the
[APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)'s approach.

The library does **not** write `aria-pressed`. That attribute is only valid on something with button
semantics, and `pauseButtonSelector` can match any element — so writing it risks an
`aria-allowed-attr` violation in your page, introduced by an accessibility feature. It would also
double-signal against the label swap: a control whose text already reads "Play" does not also need
to announce "pressed".

The attribute tracks the reader's **own** pause, not the effective state — a hover or focus pause
is deliberately not mirrored. The label it drives has to describe what the *next press* does, and
the press acts on exactly this. So while hover is holding the marquee still, the control still reads
"Pause": pressing it is what makes that stop survive the pointer moving away.

This also keeps the control correct under the input methods that pause the marquee *by reaching for
it*. The button is inside the container, so `mousedown` focusing it (Chrome, Firefox) or a tap's
emulated `mouseenter` (touch) stops the marquee before the press is even handled. A control that
toggled on the effective state would read that as "already paused", resume, and do the opposite of
what the reader pressed.

### Explicit intent outranks hover and focus

A press is a standing decision, and it beats the transient hover and focus pauses in both
directions.

**Pausing holds.** Leaving hover or moving focus out never resumes a marquee the reader stopped on
purpose — a mechanism another gesture can silently undo is not a mechanism.

**Resuming holds too, and this is not symmetric politeness.** The button lives inside the container,
so under `pauseOnHover` the pointer is *always* on the marquee at the moment of the press. If a
press only cleared its own flag, the hover pause would immediately re-assert and the control would
be permanently dead in that configuration. So an explicit resume outranks hover and focus rather
than clearing them, and retires itself once the pointer leaves and focus moves out — after which the
next hover or tab-in pauses normally again.

That override is recorded **only** while hover or focus is actually holding the marquee. With
nothing transient to outrank there is nothing to override, and recording one anyway would linger —
it is only retired on `mouseleave` and `focusout` — and swallow the next hover entirely.

One consequence worth knowing: pressing pause on a marquee already stopped by hover or focus looks
like nothing happened. It did — the stop is now the reader's, and it outlives the pointer. Releasing
it takes a second press.

The upshot for `isPaused()`: it reports whether the marquee is moving, from any cause — an explicit
pause, a hover or focus pause, or reduced motion.

### Under reduced motion the button is hidden

While reduced motion is applied the marquee cannot move and `isPaused()` already reports `true`, so
the button has nothing to control and is hidden with an inline `display: none`. Hiding follows the
**applied** state, not the OS preference: with `respectReducedMotion: false` the marquee moves and
the button stays. Whatever inline `display` the button already had is recorded and restored verbatim
when the preference turns off or the instance is destroyed, along with any `data-marquee-paused` it
carried before the library touched it.

### Opting out and diagnostics

With no button in the container, the library warns — unconditionally, on every environment,
including production. There is no environment detection in this package, and adding a
`process.env.NODE_ENV` guard would throw `ReferenceError: process is not defined` on the CDN path
the README documents. For a marquee that deliberately ships no button, say so and the warning goes
away:

```typescript
initMarquee({ pauseButton: false });
```

```html
<!-- Or per element, with initMarquee() -->
<div data-marquee data-marquee-pause-button-enabled="false">…</div>
```

Or point the library at your own selector instead of the marker attribute:

```typescript
initMarquee({ pauseButtonSelector: '.my-marquee-stop' });
```

An invalid selector is warned about and treated as "no button" — it never takes the marquee itself
down with it.

## Pause on focus

`pauseOnFocus` is the keyboard counterpart to `pauseOnHover`: while focus sits inside the container
the marquee holds still, so a reader tabbing through its links is not chasing a moving target.

```typescript
initMarquee({ pauseOnFocus: true });
```

```html
<div data-marquee data-marquee-pause-on-focus="true">…</div>
```

The pause button counts as inside the container, because it is. Tabbing from a link towards the
control therefore does not restart the marquee under the reader's hands; the press that follows
makes that stop the reader's own, so it survives tabbing back out.

Two things limit how far this reaches on its own, which is why it is not a substitute for the
button. A running marquee's container is `overflow: hidden` and not a scroll container, so it is not
focusable itself: if your items carry no links or buttons, there is nothing inside to focus. And
neither focus nor hover helps a touch user, or assistive technology driven in a mode that moves
neither.

`pauseOnHover` and `pauseOnFocus` both stay `false` by default. Flipping either one does not get you
2.2.2 — with a button, the button is the conforming mechanism; without one, hover and focus miss
exactly the users who need the mechanism most.

## Clones and the accessibility tree

The marquee fills the track by cloning its wrapper. Every clone gets `aria-hidden="true"`, and every
focusable element inside it gets `tabindex="-1"` — otherwise a screen reader would announce each
item several times over, and every cloned link would become a duplicate tab stop.

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
