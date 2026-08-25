// Rainbow DJ: one deck with a jog platter, twelve live-synthesised pads and a
// channel strip (volume/pitch/filter/delay/reverb); a shared 16-step editable
// sequencer; a cue button; a recorder; and a canvas visualiser driven by an
// AnalyserNode. Nothing is pre-recorded — every sound is built from
// oscillators and noise at the moment it's played.

import { PADS, padColor, SEQ_SOUNDS } from "./pads";
import { createDeckBus, panNode, type DeckBus } from "./fx";

type PadId = (typeof PADS)[number]["id"];
type GlowSource = PadId | "jog";

const HUES: Record<PadId, number> = Object.fromEntries(PADS.map((p) => [p.id, p.hue])) as Record<
  PadId,
  number
>;
const LABELS: Record<PadId, string> = Object.fromEntries(PADS.map((p) => [p.id, p.label])) as Record<
  PadId,
  string
>;

function colorFor(source: GlowSource): string {
  if (source === "jog") return "#ff8c1a";
  return padColor(HUES[source]);
}

const pads = Array.from(document.querySelectorAll<HTMLButtonElement>(".pad"));
const statusEl = document.getElementById("status");
const canvas = document.getElementById("viz") as HTMLCanvasElement | null;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

// --- deck state, kept alive even before the AudioContext exists so sliders
// touched pre-gesture are honoured the moment audio() creates the bus ---
let deckA: DeckBus | null = null;
let deckAVolume = 0.9;
let deckAPitch = 1;
let deckAFilter = 0;
let deckADelay = 0;
let deckAReverb = 0;

function bus(): AudioNode {
  audio();
  return deckA!.input;
}

function pitch(): number {
  return deckAPitch;
}

function audio(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser);
    analyser.connect(ctx.destination);

    deckA = createDeckBus(ctx, master);
    deckA.setVolume(deckAVolume);
    deckA.setFilter(deckAFilter);
    deckA.setDelaySend(deckADelay);
    deckA.setReverbSend(deckAReverb);
    deckA.setCrossfade(1);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(): AudioBuffer {
  const c = audio();
  if (!noiseBuffer) {
    const length = c.sampleRate * 2;
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseSource(): AudioBufferSourceNode {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = noise();
  src.loop = true;
  return src;
}

// Each effect wires up nodes into a `destination` (a deck's bus input, or the
// shared master for the sequencer's own voices), starts them, and schedules
// its own stop/disconnect. A little pitch/timing jitter and a stereo pan node
// keep repeats from sounding identical or mono-flat. Pitched components scale
// with the calling deck's pitch fader, matching turntable vari-speed.
const jitter = (spread: number) => 1 + (Math.random() - 0.5) * spread;

function playCrash(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const dur = 1.4;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 5000 * pitchRatio;
  const shimmer = c.createBiquadFilter();
  shimmer.type = "peaking";
  shimmer.frequency.value = 9000 * pitchRatio;
  shimmer.Q.value = 1.2;
  shimmer.gain.value = 8;
  const gain = c.createGain();
  const pan = panNode(c, 0.2);
  gain.gain.setValueAtTime(0.6 * jitter(0.1), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter).connect(shimmer).connect(gain).connect(pan).connect(destination);
  src.start(now);
  src.stop(now + dur + 0.1);
}

function playCowbell(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const dur = 0.35;
  const gain = c.createGain();
  const pan = panNode(c);
  gain.connect(pan).connect(destination);
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  for (const freq of [540, 800]) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq * jitter(0.02) * pitchRatio;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
}

function playLaser(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const gain = c.createGain();
  const pan = panNode(c);
  gain.connect(pan).connect(destination);
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1600 * jitter(0.1) * pitchRatio, now);
  osc.frequency.exponentialRampToValueAtTime(80 * pitchRatio, now + 0.28);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);

  const sub = c.createOscillator();
  sub.type = "square";
  sub.frequency.setValueAtTime(800 * jitter(0.1) * pitchRatio, now);
  sub.frequency.exponentialRampToValueAtTime(40 * pitchRatio, now + 0.28);
  const subGain = c.createGain();
  subGain.gain.value = 0.3;
  sub.connect(subGain).connect(gain);
  sub.start(now);
  sub.stop(now + 0.3);
}

function playTomRoll(destination: AudioNode, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const hits = 6;
  const spacing = 0.09;
  const pan = c.createStereoPanner();
  pan.connect(destination);

  for (let i = 0; i < hits; i++) {
    const t = now + i * spacing;
    const gain = c.createGain();
    gain.connect(pan);
    const level = 0.7 * (0.55 + 0.45 * (i / (hits - 1)));
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + spacing * 0.9);

    const osc = c.createOscillator();
    osc.type = "sine";
    const base = 140 * jitter(0.04);
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + spacing * 0.85);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + spacing);
  }
}

function playDrop(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const gain = c.createGain();
  const pan = panNode(c, 0.15);
  gain.connect(pan).connect(destination);
  gain.gain.setValueAtTime(0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180 * jitter(0.08) * pitchRatio, now);
  osc.frequency.exponentialRampToValueAtTime(30 * pitchRatio, now + 0.65);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.7);

  // a sub layer an octave down for extra weight
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(90 * jitter(0.08) * pitchRatio, now);
  sub.frequency.exponentialRampToValueAtTime(15 * pitchRatio, now + 0.65);
  const subGain = c.createGain();
  subGain.gain.value = 0.6;
  sub.connect(subGain).connect(gain);
  sub.start(now);
  sub.stop(now + 0.7);
}

function playVinylStop(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const dur = 1.1;
  const gain = c.createGain();
  const pan = panNode(c, 0.2);
  gain.connect(pan).connect(destination);
  gain.gain.setValueAtTime(0.8, now);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  const start = 220 * pitchRatio;
  osc.frequency.setValueAtTime(start, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, start * 0.05), now + dur);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + dur + 0.05);

  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(start / 2, now);
  sub.frequency.exponentialRampToValueAtTime(Math.max(9, (start / 2) * 0.05), now + dur);
  const subGain = c.createGain();
  subGain.gain.value = 0.5;
  sub.connect(subGain).connect(gain);
  sub.start(now);
  sub.stop(now + dur + 0.05);
}

function playReverse(destination: AudioNode, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const dur = 0.6;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 4000;
  const gain = c.createGain();
  const pan = panNode(c, 0.3);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.6 * jitter(0.1), now + dur);
  gain.gain.linearRampToValueAtTime(0, now + dur + 0.05);
  src.connect(filter).connect(gain).connect(pan).connect(destination);
  src.start(now);
  src.stop(now + dur + 0.1);
}

function playSnare(destination: AudioNode, pitchRatio = 1, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const pan = panNode(c, 0.2);
  pan.connect(destination);

  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1500;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  src.connect(filter).connect(noiseGain).connect(pan);
  src.start(now);
  src.stop(now + 0.18);

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 190 * pitchRatio;
  const toneGain = c.createGain();
  toneGain.gain.setValueAtTime(0.4, now);
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(toneGain).connect(pan);
  osc.start(now);
  osc.stop(now + 0.14);
}

function playScratch(destination: AudioNode) {
  const c = audio();
  const now = c.currentTime;
  const dur = 0.5;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 6;

  const gain = c.createGain();
  src.connect(filter).connect(gain).connect(destination);

  // A handful of forward/back "scratch" strokes: the filter sweeps while the
  // gain gates on and off, so it reads as scratching rather than a hum.
  const strokes = 4 + Math.floor(Math.random() * 2);
  let t = now;
  gain.gain.setValueAtTime(0, t);
  for (let i = 0; i < strokes; i++) {
    const strokeDur = dur / strokes;
    const up = i % 2 === 0;
    filter.frequency.setValueAtTime(up ? 300 : 3000, t);
    filter.frequency.linearRampToValueAtTime(up ? 3000 : 300, t + strokeDur * 0.8);
    gain.gain.linearRampToValueAtTime(0.6, t + strokeDur * 0.1);
    gain.gain.linearRampToValueAtTime(0.05, t + strokeDur * 0.85);
    t += strokeDur;
  }
  gain.gain.linearRampToValueAtTime(0, t + 0.05);

  src.start(now);
  src.stop(t + 0.1);
}

function playClap(destination: AudioNode, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  // A clap is a few overlapping noise bursts, each highpassed, short, and
  // panned slightly differently so the burst has some width.
  const offsets = [0, 0.01, 0.02, 0.03, 0.11];
  for (const offset of offsets) {
    const t = now + offset;
    const src = noiseSource();
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000 * jitter(0.15);
    const gain = c.createGain();
    const pan = panNode(c, 0.35);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(filter).connect(gain).connect(pan).connect(destination);
    src.start(t);
    src.stop(t + 0.1);
  }
}

function playHatRoll(destination: AudioNode, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const hits = 8;
  for (let i = 0; i < hits; i++) {
    const t = now + i * 0.045;
    const src = noiseSource();
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7500;
    const gain = c.createGain();
    const pan = panNode(c, 0.25);
    const level = 0.28 * (1 - i / (hits + 2));
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(filter).connect(gain).connect(pan).connect(destination);
    src.start(t);
    src.stop(t + 0.04);
  }
}

function playStab(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const gain = c.createGain();
  const pan = panNode(c);
  gain.connect(pan).connect(destination);
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  const base = 392 * pitchRatio * jitter(0.02);
  for (const ratio of [1, 1.25, 1.5]) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = base * ratio;
    osc.detune.value = (Math.random() - 0.5) * 8;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

function playRimshot(destination: AudioNode, pitchRatio: number, startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const pan = panNode(c, 0.1);
  pan.connect(destination);

  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1400 * pitchRatio * jitter(0.03), now);
  osc.frequency.exponentialRampToValueAtTime(280 * pitchRatio, now + 0.05);
  const toneGain = c.createGain();
  toneGain.gain.setValueAtTime(0.6, now);
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(toneGain).connect(pan);
  osc.start(now);
  osc.stop(now + 0.07);

  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 3;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  src.connect(filter).connect(noiseGain).connect(pan);
  src.start(now);
  src.stop(now + 0.05);
}

// The sequencer's own two voices — not pad sounds, always routed straight to
// master (the shared drum machine isn't part of either deck's FX chain).
function playKick(startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playHat(startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  src.connect(filter).connect(gain).connect(master!);
  src.start(now);
  src.stop(now + 0.06);
}

const SOUNDS: Record<PadId, (destination: AudioNode, pitchRatio: number, startTime?: number) => void> = {
  crash: playCrash,
  cowbell: playCowbell,
  laser: playLaser,
  tomroll: (d, _p, t) => playTomRoll(d, t),
  drop: playDrop,
  vinylstop: playVinylStop,
  reverse: (d, _p, t) => playReverse(d, t),
  snare: (d, p, t) => playSnare(d, p, t),
  clap: (d, _p, t) => playClap(d, t),
  hatroll: (d, _p, t) => playHatRoll(d, t),
  stab: playStab,
  rimshot: playRimshot,
};

function trigger(pad: HTMLButtonElement, opts: { announce?: boolean } = {}) {
  const { announce = true } = opts;
  const sound = pad.dataset.sound as PadId | undefined;
  if (!sound) return;
  SOUNDS[sound](bus(), pitch());

  pad.classList.add("hit");
  setTimeout(() => pad.classList.remove("hit"), 140);

  if (announce && statusEl) {
    statusEl.textContent = `Playing: ${LABELS[sound]}`;
  }

  if (recording) recordedHits.push({ sound, t: performance.now() - recordStart });
}

for (const pad of pads) {
  pad.addEventListener("pointerdown", () => trigger(pad));
  pad.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      trigger(pad);
    }
  });
}

// Matched on e.code (not e.key) so Shift/other modifiers changing the
// character a key produces doesn't break the shortcut.
document.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  const pad = pads.find((p) => p.dataset.code === e.code);
  if (pad && document.activeElement !== pad) trigger(pad);
});

// --- jog platter: click, tap or Enter/Space plays a random scratch move ---
const jog = document.getElementById("jog-a") as HTMLButtonElement | null;
jog?.addEventListener("click", () => {
  playScratch(bus());
  jog.classList.remove("scratching");
  void jog.offsetWidth; // restart the wobble animation on repeat hits
  jog.classList.add("scratching");
  setTimeout(() => jog.classList.remove("scratching"), 600);

  if (statusEl) statusEl.textContent = "Spun the jog wheel — scratching.";
});

// --- channel strip: volume, pitch, filter, delay send, reverb send ---
const volumeSlider = document.getElementById("volume-a") as HTMLInputElement | null;
const pitchSlider = document.getElementById("pitch-a") as HTMLInputElement | null;
const pitchLabel = document.getElementById("pitch-label-a");
const filterSlider = document.getElementById("filter-a") as HTMLInputElement | null;
const delaySlider = document.getElementById("delay-a") as HTMLInputElement | null;
const reverbSlider = document.getElementById("reverb-a") as HTMLInputElement | null;

volumeSlider?.addEventListener("input", () => {
  const v = Number(volumeSlider.value);
  deckAVolume = v;
  deckA?.setVolume(v);
});

pitchSlider?.addEventListener("input", () => {
  const percent = Number(pitchSlider.value);
  deckAPitch = 1 + percent / 100;
  if (pitchLabel) pitchLabel.textContent = `${percent > 0 ? "+" : ""}${percent}%`;
});

filterSlider?.addEventListener("input", () => {
  const v = Number(filterSlider.value);
  deckAFilter = v;
  deckA?.setFilter(v);
});

delaySlider?.addEventListener("input", () => {
  const v = Number(delaySlider.value);
  deckADelay = v;
  deckA?.setDelaySend(v);
});

reverbSlider?.addEventListener("input", () => {
  const v = Number(reverbSlider.value);
  deckAReverb = v;
  deckA?.setReverbSend(v);
});

// --- the sequencer: an editable, extensible set of 16-step tracks, each
// assignable to any sound (kick/hat, the two drum-machine-only voices, or any
// pad), 128 BPM. Rows can be added or removed live; the underlying Astro
// markup just seeds the first three (kick/snare/hat) so there's something to
// play on load.
const beatsBtn = document.getElementById("beats-btn") as HTMLButtonElement | null;
const cueBtn = document.getElementById("cue-btn") as HTMLButtonElement | null;
const BPM = 128;
const STEPS = 16;
const STEP_SECONDS = 60 / BPM / 4;
const MIN_ROWS = 1;
const MAX_ROWS = 8;

interface SeqRow {
  id: string;
  sound: string;
  pattern: boolean[];
  el: HTMLDivElement;
  stepButtons: HTMLButtonElement[];
}

let rowCounter = 0;
const rows: SeqRow[] = [];
const seqRowsEl = document.getElementById("seq-rows") as HTMLDivElement | null;
const addRowBtn = document.getElementById("seq-add-btn") as HTMLButtonElement | null;

function makeRowSkeleton(sound: string, patternBits: boolean[]): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "seq-row";

  const select = document.createElement("select");
  select.className = "seq-sound";
  select.setAttribute("aria-label", "Track sound");
  for (const opt of SEQ_SOUNDS) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === sound) o.selected = true;
    select.appendChild(o);
  }

  const steps = document.createElement("div");
  steps.className = "seq-steps";
  for (let i = 0; i < STEPS; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = i % 4 === 0 ? "step-btn beat" : "step-btn";
    btn.dataset.step = String(i);
    btn.setAttribute("aria-pressed", patternBits[i] ? "true" : "false");
    steps.appendChild(btn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "seq-remove";
  removeBtn.setAttribute("aria-label", "Remove this track");
  removeBtn.textContent = "✕";

  el.append(select, steps, removeBtn);
  return el;
}

function adoptRow(el: HTMLDivElement): SeqRow {
  const select = el.querySelector<HTMLSelectElement>(".seq-sound")!;
  const removeBtn = el.querySelector<HTMLButtonElement>(".seq-remove")!;
  const stepButtons = Array.from(el.querySelectorAll<HTMLButtonElement>(".step-btn"));
  const id = `row-${rowCounter++}`;
  const pattern = stepButtons.map((b) => b.getAttribute("aria-pressed") === "true");
  const row: SeqRow = { id, sound: select.value, pattern, el, stepButtons };

  function relabelSteps() {
    const label = select.options[select.selectedIndex]?.text ?? row.sound;
    stepButtons.forEach((btn, i) => btn.setAttribute("aria-label", `${label} step ${i + 1}`));
  }
  relabelSteps();

  stepButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const active = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", active ? "false" : "true");
      row.pattern[i] = !active;
    });
  });
  select.addEventListener("change", () => {
    row.sound = select.value;
    relabelSteps();
  });
  removeBtn.addEventListener("click", () => removeRow(row.id));

  return row;
}

function updateRowControlsAvailability() {
  if (addRowBtn) addRowBtn.disabled = rows.length >= MAX_ROWS;
  for (const row of rows) {
    const removeBtn = row.el.querySelector<HTMLButtonElement>(".seq-remove");
    if (removeBtn) removeBtn.disabled = rows.length <= MIN_ROWS;
  }
}

function removeRow(id: string) {
  if (rows.length <= MIN_ROWS) return;
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return;
  rows[idx].el.remove();
  rows.splice(idx, 1);
  updateRowControlsAvailability();
}

for (const el of Array.from(document.querySelectorAll<HTMLDivElement>(".seq-row"))) {
  rows.push(adoptRow(el));
}
updateRowControlsAvailability();

addRowBtn?.addEventListener("click", () => {
  if (rows.length >= MAX_ROWS) return;
  const el = makeRowSkeleton("kick", new Array(STEPS).fill(false));
  seqRowsEl?.appendChild(el);
  rows.push(adoptRow(el));
  updateRowControlsAvailability();
  if (statusEl) statusEl.textContent = "Added a new sequencer track — pick its sound and tap in a pattern.";
});

function updatePlayheadUI(step: number) {
  for (const row of rows) {
    for (const btn of row.stepButtons) {
      btn.classList.toggle("current", Number(btn.dataset.step) === step);
    }
  }
}

let beatsOn = false;
let beatSchedulerId: number | null = null;
let nextStepTime = 0;
let stepIndex = 0;
let loopStartTime = 0;
let uiRafId: number | null = null;

function playRowSound(sound: string, time: number) {
  if (sound === "kick") {
    playKick(time);
    return;
  }
  if (sound === "hat") {
    playHat(time);
    return;
  }
  SOUNDS[sound as PadId]?.(master!, 1, time);
}

function scheduleStep(step: number, time: number) {
  for (const row of rows) {
    if (row.pattern[step]) playRowSound(row.sound, time);
  }
}

function beatTick() {
  const c = audio();
  while (nextStepTime < c.currentTime + 0.12) {
    scheduleStep(stepIndex, nextStepTime);
    nextStepTime += STEP_SECONDS;
    stepIndex = (stepIndex + 1) % STEPS;
  }
}

function startUiPlayhead() {
  function frame() {
    const c = audio();
    const elapsed = c.currentTime - loopStartTime;
    const current = Math.floor(elapsed / STEP_SECONDS) % STEPS;
    updatePlayheadUI(current);
    uiRafId = requestAnimationFrame(frame);
  }
  uiRafId = requestAnimationFrame(frame);
}

function stopUiPlayhead() {
  if (uiRafId !== null) cancelAnimationFrame(uiRafId);
  uiRafId = null;
  updatePlayheadUI(-1);
}

function startBeats() {
  const c = audio();
  stepIndex = 0;
  nextStepTime = c.currentTime + 0.05;
  loopStartTime = nextStepTime;
  beatSchedulerId = window.setInterval(beatTick, 25);
  startUiPlayhead();
  beatsOn = true;
}

function stopBeats() {
  if (beatSchedulerId !== null) clearInterval(beatSchedulerId);
  beatSchedulerId = null;
  stopUiPlayhead();
  beatsOn = false;
}

// --- the looper: record what you play on the pads; a dedicated Play loop
// button plays it back, kept separate from the sequencer's own Play beat so
// the two never fight over one button ---
const recordBtn = document.getElementById("record-btn") as HTMLButtonElement | null;
const recordBtnText = recordBtn?.querySelector<HTMLSpanElement>(".btn-text") ?? null;
const recordTimerEl = document.getElementById("record-timer");
const loopPlayBtn = document.getElementById("loop-play-btn") as HTMLButtonElement | null;
const MAX_RECORD_MS = 8000;

let recording = false;
let recordStart = 0;
let recordedHits: { sound: PadId; t: number }[] = [];
let recordedDuration = 0;
let recordStopTimer: number | null = null;
let recordTimerInterval: number | null = null;
let playbackActive = false;
let playbackTimers: number[] = [];

function updateLoopBtnAvailability() {
  if (loopPlayBtn) loopPlayBtn.disabled = recordedHits.length === 0;
}

function stopPlayback() {
  playbackActive = false;
  for (const timer of playbackTimers) clearTimeout(timer);
  playbackTimers = [];
  loopPlayBtn?.setAttribute("aria-pressed", "false");
}

function schedulePlaybackCycle() {
  playbackTimers = recordedHits.map((hit) =>
    window.setTimeout(() => {
      const pad = pads.find((p) => p.dataset.sound === hit.sound);
      if (pad) trigger(pad, { announce: false });
    }, hit.t),
  );
  const cycleLength = Math.max(recordedDuration, 200);
  playbackTimers.push(
    window.setTimeout(() => {
      if (playbackActive) schedulePlaybackCycle();
    }, cycleLength),
  );
}

function startPlayback() {
  if (recordedHits.length === 0) return;
  playbackActive = true;
  schedulePlaybackCycle();
  loopPlayBtn?.setAttribute("aria-pressed", "true");
}

beatsBtn?.addEventListener("click", () => {
  audio();
  if (beatsOn) {
    stopBeats();
    beatsBtn.setAttribute("aria-pressed", "false");
    if (statusEl) statusEl.textContent = "Sequencer stopped.";
  } else {
    startBeats();
    beatsBtn.setAttribute("aria-pressed", "true");
    if (statusEl) statusEl.textContent = "Sequencer running.";
  }
});

loopPlayBtn?.addEventListener("click", () => {
  audio();
  if (recordedHits.length === 0) return;
  if (playbackActive) {
    stopPlayback();
    if (statusEl) statusEl.textContent = "Stopped your recorded loop.";
  } else {
    startPlayback();
    if (statusEl) statusEl.textContent = "Playing back what you recorded.";
  }
});

function startRecording() {
  stopPlayback();
  recording = true;
  recordedHits = [];
  recordStart = performance.now();
  recordBtn?.setAttribute("aria-pressed", "true");
  if (recordBtnText) recordBtnText.textContent = "Stop";
  if (recordTimerEl) recordTimerEl.textContent = "0.0s";
  recordTimerInterval = window.setInterval(() => {
    const elapsed = (performance.now() - recordStart) / 1000;
    if (recordTimerEl) recordTimerEl.textContent = `${elapsed.toFixed(1)}s`;
  }, 100);
  if (statusEl) statusEl.textContent = "Recording your loop — up to 8s of pad hits.";
  recordStopTimer = window.setTimeout(stopRecording, MAX_RECORD_MS);
}

function stopRecording() {
  if (!recording) return;
  recording = false;
  recordedDuration = performance.now() - recordStart;
  recordBtn?.setAttribute("aria-pressed", "false");
  if (recordBtnText) recordBtnText.textContent = "Record";
  if (recordTimerInterval !== null) clearInterval(recordTimerInterval);
  recordTimerInterval = null;
  if (recordTimerEl) recordTimerEl.textContent = `${(recordedDuration / 1000).toFixed(1)}s`;
  if (recordStopTimer !== null) clearTimeout(recordStopTimer);
  recordStopTimer = null;
  updateLoopBtnAvailability();
  if (statusEl) {
    statusEl.textContent = recordedHits.length
      ? `Captured ${recordedHits.length} hit${recordedHits.length === 1 ? "" : "s"} — press Play loop to replay them.`
      : "Recording stopped — nothing captured.";
  }
}

recordBtn?.addEventListener("click", () => {
  audio();
  if (recording) stopRecording();
  else startRecording();
});

// --- cue: press and hold to preview the sequencer quietly and jump back on release ---
let cueWasTemporary = false;

function cueDown() {
  audio();
  if (beatsOn) {
    stepIndex = 0;
    nextStepTime = audio().currentTime + 0.02;
    loopStartTime = nextStepTime;
    cueWasTemporary = false;
  } else {
    cueWasTemporary = true;
    startBeats();
    beatsBtn?.setAttribute("aria-pressed", "true");
  }
  if (statusEl) statusEl.textContent = "Cue — back to the top.";
}

function cueUp() {
  if (cueWasTemporary) {
    stopBeats();
    beatsBtn?.setAttribute("aria-pressed", "false");
    cueWasTemporary = false;
    if (statusEl) statusEl.textContent = "Cue released.";
  }
}

cueBtn?.addEventListener("pointerdown", cueDown);
cueBtn?.addEventListener("pointerup", cueUp);
cueBtn?.addEventListener("pointerleave", cueUp);
cueBtn?.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    cueDown();
  }
});
cueBtn?.addEventListener("keyup", (e) => {
  if (e.code === "Enter" || e.code === "Space") cueUp();
});

updateLoopBtnAvailability();

// Visualiser: a frequency-bar deck that runs continuously, rainbow-tinted.
if (canvas) {
  const ctx2d = canvas.getContext("2d")!;
  let cssWidth = canvas.clientWidth || canvas.width;
  let cssHeight = canvas.clientHeight || canvas.height;

  function resizeCanvas() {
    if (!canvas) return;
    cssWidth = canvas.clientWidth || canvas.width;
    cssHeight = canvas.clientHeight || canvas.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(canvas);

  const order: PadId[] = PADS.map((p) => p.id as PadId);

  function draw() {
    const w = cssWidth;
    const h = cssHeight;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.fillStyle = "#0a0a0f";
    ctx2d.fillRect(0, 0, w, h);

    let data: Uint8Array<ArrayBuffer> | null = null;
    if (analyser) {
      data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      analyser.getByteFrequencyData(data);
    }

    const bars = order.length * 4;
    const barWidth = w / bars;
    for (let i = 0; i < bars; i++) {
      const id = order[i % order.length];
      const level = data ? data[Math.floor((i / bars) * data.length)] / 255 : 0;
      const idle = 0.04 + 0.02 * Math.sin(performance.now() / 400 + i);
      const height = Math.max(idle, level) * h;
      ctx2d.fillStyle = colorFor(id);
      ctx2d.globalAlpha = data && level > 0.02 ? 0.95 : 0.35;
      ctx2d.fillRect(i * barWidth + 1, h - height, barWidth - 2, height);
    }
    ctx2d.globalAlpha = 1;

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
