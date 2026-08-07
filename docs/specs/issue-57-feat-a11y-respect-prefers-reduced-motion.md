---
issue_number: 57
issue_title: "feat(a11y): respect prefers-reduced-motion"
repo: "refokus-agency/marquee"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "beogip/issue-57-respect-prefers-reduced"
created_at: "2026-08-04T12:37:02Z"
---

# Implementation Plan: #57 — feat(a11y): respect prefers-reduced-motion

Discovery: 15 branches opened, 14 decisions recorded. Full reasoning trail in
`.cothinker/session-2026-08-04-57-respect-prefers-reduced-motion.md` (gitignored).

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | modify | `src/types.ts` | Add `respectReducedMotion` to `MarqueeOptions` and `respectReducedMotionAttribute` to `MarqueeConfig` |
| 2 | modify | `src/Marquee.ts` | Media-query gate, reduced-motion enter/exit, overflow save+restore, position reset, drag gating, `markDecorative()` on clones, `isPaused`, resize guard, destroy teardown |
| 3 | modify | `src/index.ts` | `DEFAULT_CONFIG` entry, attribute default, attribute reading, option pass-through |
| 4 | create | `src/__tests__/helpers/matchMedia.ts` | Controllable `matchMedia` stub (new convention: first helpers file in this repo) |
| 5 | modify | `src/__tests__/Marquee.test.ts` | Behavior tests |
| 6 | modify | `src/__tests__/index.test.ts` | Option + attribute plumbing tests |
| 7 | modify | `README.md` | Options tables (449-470), new reduced-motion section, note the scroll + clone-a11y behavior |

## Codebase Context

- No `CLAUDE.md` in this repo. No `.codegraph/` index.
- **The library ships ZERO CSS.** `Marquee.ts:37` documents the integrator's contract:
  container `overflow: hidden, max-width: 100%`; track `display: flex, width: max-content`.
  D4 makes the reduced-motion overflow the first style the library ever writes on the container.
- Adding an option touches **two** default objects: `DEFAULT_OPTIONS` (`Marquee.ts:15-21`) and
  `DEFAULT_CONFIG` (`index.ts:15-27`). Attribute reading follows the `elementDraggable` /
  `elementPauseOnHover` pattern at `index.ts:62-80`.
- `isVertical()` already exists (`Marquee.ts:171,176,351`) — reuse it for axis selection rather
  than re-deriving from `direction`.
- Reuse `updateClones()` (`Marquee.ts:190-212`) as the single clone-creation site, so the clone
  a11y treatment automatically covers resize-driven clone growth.
- `initialize()` order (`Marquee.ts:104-140`): `updateClones()` at 133 runs **before**
  `setupAnimation()` at 134 — clones already exist when the ticker is registered.
- Today's `pause()` does **not** deregister the ticker (`Marquee.ts:274-284`); the callback runs
  every frame and early-returns at line 216. `gsap.ticker.remove` appears in exactly one place:
  `destroy()` at line 325. Reduced motion introduces a third "not moving" state.
- Tests: Vitest + jsdom (`vite.config.ts:19-22`). **GSAP is not mocked.** jsdom lacks
  `IntersectionObserver`, so `waitForViewport` resolves immediately and tests proceed after one
  `await Promise.resolve()`. `vi.unstubAllGlobals()` already in `afterEach`
  (`Marquee.test.ts:40`) — the established global-stubbing idiom.
- `README.md:405` warns that `gsap.matchMedia()` contexts do not carry across two GSAP cores —
  relevant to the `docs/examples/local` import-map + shim setup.

## Steps

1. Add `respectReducedMotion?: boolean` (default `true`) to `MarqueeOptions` and
   `respectReducedMotionAttribute?: string` to `MarqueeConfig` → `src/types.ts`
   **Done when:** `npm run typecheck` passes and both fields appear in the built `.d.ts`.

2. Wire defaults + attribute reading → `src/Marquee.ts:15-21`, `src/index.ts:15-27,62-80`
   **Done when:** an element carrying `data-marquee-respect-reduced-motion="false"` initialized
   via `initMarquee()` produces an instance that registers the ticker while a stubbed
   `matchMedia` reports `reduce`.

3. Split `setupAnimation()` into `createTickerCallback()` (construction only) and a
   `startMotion()` / `stopMotion()` pair (lifecycle) → `src/Marquee.ts:214-226`
   **Done when:** no function both builds the ticker callback and calls `gsap.ticker.add`.

4. Add `setupReducedMotionGate()`: feature-detect `window.matchMedia`, start motion by default,
   then register ONE `gsap.matchMedia()` context on `(prefers-reduced-motion: reduce)` whose body
   freezes and whose cleanup restores → `src/Marquee.ts`, called from `initialize()` in place of
   the bare `setupAnimation()` call at line 134
   **Done when:** with `matchMedia` stubbed to `reduce` no marquee callback is registered on
   `gsap.ticker`; with it stubbed to no-reduce, one is.

5. Implement `enterReducedMotion()`: `position` → 0 with the transform applied, save the prior
   inline overflow for the active axis, write the scroll value, kill the drag Observer
   → `src/Marquee.ts`
   **Done when:** the container's inline style shows the axis-correct scroll value, the track
   transform is 0, and `this.observer` is `null`.

6. Implement `exitReducedMotion()`: restore the saved inline overflow verbatim, zero
   `scrollLeft`/`scrollTop`, re-create the drag Observer when `draggable`, resume motion
   → `src/Marquee.ts`
   **Done when:** after a reduce→no-reduce flip the container's inline overflow byte-matches its
   pre-flip value and both scroll offsets are 0.

7. Apply `aria-hidden="true"` plus `tabindex="-1"` on focusables to every clone at creation; guard
   `handleResize` so `position` stays 0 while reduced motion is active
   → `src/Marquee.ts:190-212,261-272`
   **Done when:** every `[data-marquee-clone]` carries `aria-hidden="true"` and no `inert`, its
   focusables carry `tabindex="-1"`, and a resize fired while reduced motion is active leaves the
   track transform at 0.

8. Make `isPaused()` report `true` under reduced motion; extend `destroy()` to restore the
   overflow, reset scroll, and kill the matchMedia instance → `src/Marquee.ts:282-284,313-352`
   **Done when:** `isPaused()` is `true` with `matchMedia` stubbed to `reduce`, and after
   `destroy()` the container carries no library-written inline overflow and both scroll offsets
   are 0.

9. Document: options tables, a reduced-motion section explaining the scroll affordance and the
   always-on clone a11y treatment, and that `respectReducedMotion` is an opt-**out** of honoring
   the preference (not the detection) → `README.md`
   **Done when:** both new fields appear in the tables with correct defaults and the section
   states the scroll + clone-a11y behavior.

## Interfaces

- `MarqueeOptions.respectReducedMotion?: boolean` — default `true`; honors the OS preference.
- `MarqueeConfig.respectReducedMotionAttribute?: string` — default
  `'data-marquee-respect-reduced-motion'`.
- `SavedContainerOverflow` (internal, **not exported**, `src/Marquee.ts`):

```ts
/**
 * The container overflow declaration the library replaced while reduced motion is
 * active, captured so it can be put back verbatim.
 */
interface SavedContainerOverflow {
  /** The axis-specific property that was overwritten. */
  property: 'overflowX' | 'overflowY';
  /** The inline value present before the library wrote its own; '' when none was set. */
  previousInlineValue: string;
}
```

## Function Design

| File | Function | Single concern |
|------|----------|----------------|
| `src/Marquee.ts` | `createTickerCallback()` | Build the per-frame function, nothing else |
| `src/Marquee.ts` | `startMotion()` | Register ticker + create drag Observer |
| `src/Marquee.ts` | `stopMotion()` | Deregister ticker + kill drag Observer |
| `src/Marquee.ts` | `setupReducedMotionGate()` | Wire the media query to enter/exit |
| `src/Marquee.ts` | `enterReducedMotion()` | Apply the frozen + scrollable state |
| `src/Marquee.ts` | `exitReducedMotion()` | Undo it |
| `src/Marquee.ts` | `applyScrollOverflow()` / `restoreContainerOverflow()` | The save/restore pair |
| `src/Marquee.ts` | `resetContainerScroll()` | Zero `scrollLeft`/`scrollTop` |
| `src/Marquee.ts` | `markInert(el)` | Mechanical; called per created clone |

**FLAGGED:** today's `setupAnimation()` (`Marquee.ts:214-226`) combines construction (building the
ticker callback) with lifecycle management (`gsap.ticker.add`). Step 3 splits it. That split is a
**prerequisite** for step 4, not an optional cleanup — the gate needs to register and deregister
the callback independently of building it.

## Acceptance Criteria (EARS)

- **AC-1.** The library shall expose `respectReducedMotion` on `MarqueeOptions`, defaulting to `true`.
- **AC-2.** The library shall expose `respectReducedMotionAttribute` on `MarqueeConfig`, defaulting to `'data-marquee-respect-reduced-motion'`.
- **AC-3.** When `respectReducedMotion` is `true` and `(prefers-reduced-motion: reduce)` matches, the marquee shall not advance its position on the GSAP ticker.
- **AC-4.** When reduced motion becomes active, the marquee shall reset `position` to 0 and apply that transform.
- **AC-5.** When reduced motion becomes active, the marquee shall set a scroll overflow on the container — `overflowX` for `ltr`/`rtl`, `overflowY` for `ttb`/`btt`.
- **AC-6.** When reduced motion becomes active, the marquee shall record the container's previous inline overflow value for that axis, using `''` when none was set.
- **AC-7.** When reduced motion becomes inactive, the marquee shall restore the recorded inline overflow value verbatim.
- **AC-8.** When reduced motion becomes inactive, the marquee shall reset the container's `scrollLeft` and `scrollTop` to 0 before resuming motion.
- **AC-9.** When reduced motion becomes active and `draggable` is `true`, the marquee shall kill the drag Observer.
- **AC-10.** When reduced motion becomes inactive and `draggable` is `true`, the marquee shall re-create the drag Observer.
- **AC-11.** The marquee shall apply `aria-hidden="true"` to every clone it creates, and `tabindex="-1"` to every focusable element in it, regardless of `respectReducedMotion` and regardless of the motion preference.
- **AC-12.** If `resume()` is called while reduced motion is active, then the marquee shall not begin advancing.
- **AC-13.** `isPaused()` shall return `true` while reduced motion is active.
- **AC-14.** If a resize occurs while reduced motion is active, then `position` shall remain 0.
- **AC-15.** When `respectReducedMotion` is `false`, the marquee shall register the ticker unconditionally and shall neither read nor modify the container's overflow.
- **AC-16.** If `window.matchMedia` is unavailable, then the marquee shall animate normally and shall not throw.
- **AC-17.** If the browser does not support the `prefers-reduced-motion` feature, then the marquee shall animate.
- **AC-18.** When `destroy()` is called while reduced motion is active, the marquee shall restore the container's overflow, reset its scroll offsets, and kill the `gsap.matchMedia()` instance.
- **AC-19.** When `setDirection()` changes the axis while reduced motion is active, the marquee shall restore the previous axis's overflow and apply the new axis's.
- **AC-20.** The marquee shall not use `inert` on clones; clones shall remain operable by pointer.

## Out of Scope

- **In-page pause/play UI control** → separate issue, to be created alongside this plan. WCAG 2.2.2
  asks for an explicit mechanism, and `prefers-reduced-motion` alone is "acceptable, with
  exceptions" for conformance (hidde.blog) — so #57 stands on its own, but the control is the real
  usability complement. It carries at least five undiscussed decisions (DOM placement, styling
  with no CSS to ship, label/accessible name, new option, interaction with D11/D12) and deserves
  its own discovery session.
- Any CSS shipped by the library beyond the reduced-motion overflow.
- `aria-*` attributes, roles, or accessible names on the marquee region itself.
- `document.hidden` / `visibilitychange` pausing.
- `IntersectionObserver`-based pause when scrolled off-screen.
- Unrelated open issues: #33 (browser bundle never built), #56 (`itemSelector` discarded at
  `index.ts:44`).
- Verifying Safari's scroller-focusability behavior — documented as unverified, not tested.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | Resize while reduced motion active | [inferred] | `handleResize:270` runs `position = wrap(position)`; `gsap.utils.wrap(-N, 0)(0)` returns `-N` because max is exclusive, silently breaking AC-4. Force `position = 0` after the re-wrap. |
| 2 | Preference flips back after the user scrolled | [inferred] | `overflow: hidden` **preserves** scroll offset, so the marquee would animate from a displaced origin. Zero `scrollLeft`/`scrollTop` in `exitReducedMotion()`. |
| 3 | Integrator already had an inline overflow on the container | [inferred] | Save it and restore verbatim (D13); `''` means "no inline value was set". |
| 4 | `respectReducedMotion: false` | [from issue] | Never create `gsap.matchMedia()`; behavior identical to today. |
| 5 | `destroy()` while reduced motion active | [inferred] | Restore overflow, reset scroll, `mm.kill()`, plus existing teardown. |
| 6 | Vertical direction (`ttb`/`btt`) | [inferred] | `overflowY` via existing `isVertical()`. |
| 7 | `setDirection()` flips the axis at runtime while reduced motion active | [inferred] | Restore the old axis property, then apply the new one. |
| 8 | `window.matchMedia` absent | [inferred] | Feature-detect before `gsap.matchMedia()`; fall through to animating, never throw. |
| 9 | Browser does not support the `prefers-reduced-motion` feature | [inferred] | Gate on `reduce` only with animate-by-default. The issue's `no-preference` snippet would leave these browsers frozen forever — see Deviation below. |
| 10 | `resume()` while reduced motion active | [from issue] | `paused = false`, but the ticker is not registered, so nothing moves. |
| 11 | `isPaused()` while reduced motion active | [from issue] | Returns `true`. |
| 12 | Clones added by a later resize | [inferred] | `markDecorative()` applied at the single creation site in `updateClones()`, so growth is covered. |
| 13 | `pauseOnHover` with reduced motion active | [inferred] | Hover flips `paused`; harmless no-op. A stale `paused: true` surviving a flip-back keeps it frozen — consistent with an explicit pause. |
| 14 | Two GSAP cores (`docs/examples/local` import-map + shims) | [inferred] | `gsap.matchMedia()` is used only for callbacks, never tweens, so it works on whichever core the package imported. `README.md:405` caveat noted in docs. |
| 15 | Reduced motion already active at construction | [inferred] | `mm.add` runs its body synchronously, so ticker/Observer are created then torn down within the same tick. Accepted micro-churn in exchange for a structure that is safe on unsupporting browsers. |

### Deviation from the issue (deliberate, approved at the gate)

The issue proposes `mm.add('(prefers-reduced-motion: no-preference)', ...)`. On a browser that does
not support the media feature, **both** `no-preference` and `reduce` evaluate false, so a
`no-preference`-gated ticker would never register and the marquee would be permanently dead there.

This plan inverts it: **animate by default, and gate the freeze on `(prefers-reduced-motion:
reduce)`.** Same intent, safe fallback. Carry this reasoning into a code comment.

### Decisions that override the issue body

- The issue leaned toward keeping `draggable` working under reduced motion ("drag is user-initiated,
  so it should arguably keep working"). **Overridden:** drag and native scroll are two competing
  user-initiated mechanisms on the same axis and the same element, and on touch they fight
  directly. Scroll won because it is the mechanism that guarantees reachability. Decided, not an
  oversight.
- The issue proposed `aria-hidden` on clones. First superseded by `inert`, which excludes from the
  accessibility tree *and* the tab order in one attribute — `aria-hidden` alone would have left
  cloned links as ghost focus stops. **Reverted during review of PR #80**: `inert` also blocks
  hit-testing, and since the track translates by only one period, most visible items are clones — so
  `inert` left the majority of a marquee's links dead to the click. Settled on the issue's
  `aria-hidden` **plus `tabindex="-1"`** on focusable descendants, which closes the ghost-focus-stop
  gap that motivated `inert` in the first place, and works in every browser rather than Chrome 102+.

## Done Criteria per Feature

| Feature | Done when |
|---------|-----------|
| Option + attribute surface | AC-1, AC-2, AC-15 |
| Motion gating | AC-3, AC-12, AC-13, AC-16, AC-17 |
| Position reset | AC-4, AC-14 |
| Scroll affordance | AC-5, AC-6, AC-7, AC-8, AC-19 |
| Drag interaction | AC-9, AC-10 |
| Clone accessibility | AC-11, AC-20 |
| Teardown | AC-7, AC-8, AC-18 |

## Risks

| Risk | Mitigation |
|------|------------|
| Clone a11y treatment is **ungated** — lands for every integrator with no opt-out, and removes cloned links from the tab order | Call out in README. Against v1.4.1, which shipped no clone treatment at all, everything removed is a defect (duplicate announcements, duplicate tab stops), so it is a `fix` and not a breaking change. Clones stay clickable, which is what would have made it one. |
| A pointer can move focus into an `aria-hidden` subtree, so axe reports `aria-hidden-focus` as needs-review | Accepted and documented in the README. Mouse users who click a cloned link navigate immediately; keyboard and AT users never reach one. |
| The library writes inline styles on an element it does not own | Save/restore verbatim; add an explicit test for the pre-existing-inline-value case (edge case 3). |
| Deviation from the issue's `no-preference` snippet | Documented in this plan, surfaced at the approval gate, and to be repeated in a code comment. |
| Two GSAP cores in shim/CDN setups | Note in the `README.md:400-443` section. |
| jsdom has no `matchMedia` and GSAP is not mocked | Shared controllable stub helper; the feature-detect guard (AC-16) means unstubbed tests pass rather than crash. |
| `src/__tests__/helpers/` is a new convention for this repo | Single small file, flagged here rather than introduced silently. |
| Semver: the new option is a minor; the clone treatment is a behavior change against v1.4.1 | Everything it removes is a defect, so it ships as `fix` with no `BREAKING CHANGE:` footer. The change overall cuts a minor on the strength of the new option. |
| **Two search-engine summaries were factually wrong during discovery**, both contradicted by their own primary sources (one about hiding duplicates under reduced motion, one about `inert` and the accessibility tree) | Do not trust search synthesis while implementing — fetch the primary source. Both corrections are recorded in the session artifact. |

Runtime-generated files: `.cothinker/` is **already** in `.gitignore` (verified) — no change
needed. `docs/specs/` is a committed artifact.

## Test Strategy

Runner: Vitest + jsdom, existing conventions. Commands: `npm test`, `npm run typecheck`,
`npm run lint`, `npm run test:coverage`, `npm run validate:package`.

**New shared stub** (`src/__tests__/helpers/matchMedia.ts`): a controllable `matchMedia` returning a
handle with `setReduce(next)` that fires registered change listeners, so **preference flips** are
testable without a real browser. The flip paths (AC-7, AC-8, AC-10) are the highest-risk part of
this change and cannot be covered by an init-only stub. Installed via `vi.stubGlobal`;
`vi.unstubAllGlobals()` in `afterEach` already exists at `Marquee.test.ts:40`.

**Black-box through the public API** — `new Marquee` / `initMarquee`, `setDirection`,
`pause`/`resume`, `destroy` — not private methods. Assertions on observable state: container inline
`style.overflowX`/`overflowY`, `scrollLeft`/`scrollTop`, clone `aria-hidden`/`tabindex` presence,
`isPaused()`, and the track transform via `gsap.getProperty`.

`gsap.ticker.add`/`remove` are spied because asserting real motion is not feasible in jsdom. That
is the one white-box seam, and it is unavoidable given GSAP is not mocked.

**Specifically-named tests for the two silent-failure cases:**

- AC-14 — stub `reduce`, dispatch `resize`, advance the 150 ms debounce with fake timers, assert
  the track transform is still 0. Without this the `gsap.utils.wrap` exclusivity bug (edge case 1)
  ships silently.
- AC-16 — delete `matchMedia`, assert construction does not throw and the ticker registers.
