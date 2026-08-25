# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

Rainbow DJ, a browser instrument built around a single deck: a jog wheel for
scratches, a 12-pad grid of live-synthesised drum/FX hits (no samples — every
sound is a Web Audio graph built at play time), a channel strip with
filter/delay/reverb sends, and an editable multi-track step sequencer that can
drive the same pads.

## The moments that mattered

1. **Dynamically-added sequencer rows rendered unstyled.** Clicking "+ Add
   track" produced a row that looked nothing like the ones in the markup —
   plain native `<select>` and buttons, no bevel, no grid layout. Instead of
   patching styles onto the created elements from `main.ts`, I checked the
   compiled `dist/_astro/*.css` and found the cause: Astro scopes `<style>`
   selectors to an auto-generated `data-astro-cid-*` attribute that's only
   stamped onto elements present in the server-rendered template, so anything
   built later with `document.createElement` never matches those selectors. I
   wrapped the row-level selectors in `:global(...)` instead of duplicating
   styles in TypeScript, so the CSS stays the single source of truth for what
   a track row looks like
   ([`146f5b8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-soybeaam/commit/146f5b8)).
   I confirmed the fix by re-inspecting the built CSS output rather than just
   eyeballing the page: the fixed selectors compiled without the
   `data-astro-cid` guard, while an untouched, correctly-scoped selector
   (`.seq-rows`) still had it.

2. **Two decks turned out to be one deck's worth of scope.** Asked to drop a
   deck, I stopped before touching the crossfader, keyboard shortcuts, and CSS
   grid it implied and asked which of "hide deck B" vs. "remove it entirely"
   was wanted, since the two land at completely different amounts of surface
   area. Once "remove it" was confirmed, I grepped `spec/*.test.ts` for any
   reference to "deck" before deleting anything, so the refactor wasn't
   guessing at a hidden contract
   ([`f24d319`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-soybeaam/commit/f24d319)).
   `pnpm check` stayed green through the removal of `DeckId`, the crossfader
   wiring, and the per-deck audio routing, which is what told me nothing else
   in the app was silently depending on deck B.

3. **A canvas that only sometimes filled its box.** The visualiser's backing
   buffer was sized once from `canvas.clientWidth`/`clientHeight` at script
   load, so a layout that settled after that point (or a later viewport
   resize) left the buffer stale relative to what was actually on screen —
   exactly the kind of bug that "looks fine on my screen" but is real.
   Rather than re-measuring on a timer, I wired a `ResizeObserver` to
   recompute the CSS size, backing-buffer size and device-pixel-ratio
   transform whenever the element's box actually changes
   ([`f24d319`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-soybeaam/commit/f24d319)),
   which is the check that this class of bug can't recur without someone
   removing the observer.

4. **Retiring four pad sounds without breaking the sequencer's assumptions.**
   `pads.ts` is the single source of truth the sequencer's sound picker
   (`SEQ_SOUNDS`) derives from, so swapping horn/siren/riser/wobble for
   crash/cowbell/tomroll/rimshot only needed edits in one array plus the
   matching synthesis functions in `main.ts` — I grepped for the old ids
   across `src/` first to make sure nothing else hard-coded them before
   relying on that
   ([`f24d319`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-soybeaam/commit/f24d319)).
   `pnpm check` catches a stale reference here as a type error (`PadId` is
   derived from the array), which is what let me trust the rename instead of
   manually re-checking every call site.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: whether one renders is visible the moment you look. Open
this file on GitHub and look at it before you ship.
