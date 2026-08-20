import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Tests for crit 4's published spec ("An instrument"):
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/
//
// Mechanically checkable lines only. Left to the crit, because only a person
// can judge them: "expressive... two players sound different", "a stranger can
// play it uninstructed", "playable with whatever is at hand" (mouse, keyboard,
// touch feel), and the process/direction account.

const DIST = resolve("dist");
const home = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;
const homeSource = readFileSync(join(DIST, "index.html"), "utf8");

// Everything shipped, concatenated, to check what the built bundle actually
// contains rather than assuming a particular file layout.
const shipped = readdirSync(DIST, { recursive: true })
  .map(String)
  .filter((name) => name.endsWith(".html") || name.endsWith(".js"))
  .map((name) => readFileSync(join(DIST, name), "utf8"))
  .join("\n");

describe("crit 4: an instrument", () => {
  it("offers at least one control a player can act on", () => {
    // "the opening screen invites the first sound" — there must be *something*
    // to click, press or touch, not just prose.
    const controls = home.querySelectorAll(
      'button, [role="button"], canvas, svg, input, [tabindex]',
    );
    expect(
      controls.length,
      "the opening screen needs a visible control the player can act on",
    ).toBeGreaterThan(0);
  });

  it("uses the Web Audio API to make sound live in the page", () => {
    // "the browser is the instrument — sound is made live in the page by the
    // player, not played back". Synthesis has to run client-side via
    // AudioContext, not a canned recording.
    expect(
      shipped,
      "no reference to AudioContext found — sound should be synthesised live, not played back",
    ).toMatch(/AudioContext/);
  });

  it("ships no pre-recorded audio or video for playback", () => {
    expect(home.querySelectorAll("audio, video").length).toBe(0);
  });

  it("has no score or fail-state language", () => {
    // "there is no way to play it wrong — no score, no fail state"
    const forbidden = /\b(game over|you lose|you win|score:|high score|try again)\b/i;
    expect(homeSource).not.toMatch(forbidden);
  });
});
