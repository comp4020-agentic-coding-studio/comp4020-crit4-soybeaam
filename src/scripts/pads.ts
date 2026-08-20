// Single source of truth for the pad layout: the Astro page renders these
// (so adding a sound never means touching markup by hand) and main.ts reuses
// the same ids, labels and hues for lookup and colouring.

export interface PadDef {
  id: string;
  label: string;
  key: string;
  hue: number;
}

export const PADS: PadDef[] = [
  { id: "horn", label: "Horn", key: "1", hue: 0 },
  { id: "siren", label: "Siren", key: "2", hue: 30 },
  { id: "laser", label: "Laser", key: "3", hue: 60 },
  { id: "riser", label: "Riser", key: "4", hue: 90 },
  { id: "drop", label: "Drop", key: "5", hue: 120 },
  { id: "vinylstop", label: "Vinyl Stop", key: "6", hue: 150 },
  { id: "reverse", label: "Reverse", key: "7", hue: 180 },
  { id: "snare", label: "Snare", key: "8", hue: 210 },
  { id: "clap", label: "Clap", key: "9", hue: 240 },
  { id: "hatroll", label: "Hat Roll", key: "0", hue: 270 },
  { id: "stab", label: "Stab", key: "-", hue: 300 },
  { id: "wobble", label: "Wobble", key: "=", hue: 330 },
];

export function padColor(hue: number): string {
  return `hsl(${hue}deg 85% 52%)`;
}
