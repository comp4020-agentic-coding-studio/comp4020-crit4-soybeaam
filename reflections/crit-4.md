# Crit 4 reflection

**What was the breakthrough that moved the work forward?**

Realising the Astro CSS-scoping bug wasn't a styling problem but a rendering
problem changed how I debugged the rest of the build. My first instinct when
the newly-added sequencer row looked unstyled was to add more specific
selectors; it was only when I opened the compiled `dist/` output and saw the
`data-astro-cid-*` attribute guard missing from the row's selectors — because
that attribute only lands on elements the server actually rendered, never on
ones `document.createElement` builds later — that I understood the fix had to
be `:global()`, not a rewrite. After that, every time something rendered
"almost right", I went and looked at what actually shipped (the built CSS, the
compiled HTML) before touching source, instead of guessing from the symptom.

**What did this work change about who I want to be as a software developer?**

I want to be someone who treats "it looks wrong" as an instruction to go find
out what's actually running, not a cue to start guessing fixes. Removing an
entire deck was the same lesson at a bigger scale: the tempting move was to
just hide the markup, but I stopped to ask what "remove" actually meant before
touching audio routing, keyboard shortcuts and CSS grid that all assumed two
decks existed, and I checked the test suite for hidden dependencies before
deleting anything. Scope creep and half-finished refactors both come from
skipping that question, and this crit is the clearest case yet of it paying
off — the removal came out clean because I checked first.
