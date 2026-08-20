// Single source of truth for the pad layout: the Astro page renders these
// (so adding a sound never means touching markup by hand) and main.ts reuses
// the same ids, labels and hues for lookup and colouring.
//
// `code` is the KeyboardEvent.code (not .key) so Deck B's Shift+key
// shortcuts keep working regardless of what Shift does to the character a
// given keyboard layout produces for digits/symbols.

export interface PadDef {
  id: string;
  label: string;
  key: string;
  code: string;
  hue: number;
}

export const PADS: PadDef[] = [
  { id: "horn", label: "Horn", key: "1", code: "Digit1", hue: 0 },
  { id: "siren", label: "Siren", key: "2", code: "Digit2", hue: 30 },
  { id: "laser", label: "Laser", key: "3", code: "Digit3", hue: 60 },
  { id: "riser", label: "Riser", key: "4", code: "Digit4", hue: 90 },
  { id: "drop", label: "Drop", key: "5", code: "Digit5", hue: 120 },
  { id: "vinylstop", label: "Vinyl Stop", key: "6", code: "Digit6", hue: 150 },
  { id: "reverse", label: "Reverse", key: "7", code: "Digit7", hue: 180 },
  { id: "snare", label: "Snare", key: "8", code: "Digit8", hue: 210 },
  { id: "clap", label: "Clap", key: "9", code: "Digit9", hue: 240 },
  { id: "hatroll", label: "Hat Roll", key: "0", code: "Digit0", hue: 270 },
  { id: "stab", label: "Stab", key: "-", code: "Minus", hue: 300 },
  { id: "wobble", label: "Wobble", key: "=", code: "Equal", hue: 330 },
];

export function padColor(hue: number): string {
  return `hsl(${hue}deg 85% 52%)`;
}

// Sounds a sequencer track can be assigned to: the two drum-machine-only
// voices (kick/hat, which never appear as pads) plus every pad sound.
export const SEQ_SOUNDS: { id: string; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "hat", label: "Hat" },
  ...PADS.map((p) => ({ id: p.id, label: p.label })),
];
