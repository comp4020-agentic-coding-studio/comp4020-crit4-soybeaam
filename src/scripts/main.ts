// Rainbow DJ: twelve pads, twelve live-synthesised Web Audio effects, a jog
// platter, a channel strip (volume + pitch), a cue button, a beat machine,
// a recorder, and a canvas visualiser driven by an AnalyserNode. Nothing is
// pre-recorded — every sound is built from oscillators and noise at the
// moment it's played.

import { PADS, padColor } from "./pads";

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
let masterVolume = 0.9;
let pitchRatio = 1;

function audio(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser);
    analyser.connect(ctx.destination);
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

// Each effect returns nothing; it wires up nodes, starts them, and schedules
// its own stop/disconnect. A little pitch/timing jitter keeps repeats from
// sounding identical, in the same spirit as the pads never sounding canned.
// Pitched components scale with `pitchRatio` so the channel pitch fader
// behaves like a turntable vari-speed control, not just a tempo knob.
const jitter = (spread: number) => 1 + (Math.random() - 0.5) * spread;

function playHorn() {
  const c = audio();
  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.8, now + 0.02);
  gain.gain.setValueAtTime(0.8, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

  const base = 233 * jitter(0.03) * pitchRatio; // Bb3-ish air-horn stab
  for (const ratio of [1, 1.5, 2]) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = base * ratio;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.95);
  }
}

function playSiren() {
  const c = audio();
  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
  gain.gain.setValueAtTime(0.6, now + 1.3);
  gain.gain.linearRampToValueAtTime(0, now + 1.5);

  const osc = c.createOscillator();
  osc.type = "sine";
  const lo = 500 * jitter(0.05) * pitchRatio;
  const hi = 1000 * jitter(0.05) * pitchRatio;
  osc.frequency.setValueAtTime(lo, now);
  for (let i = 0; i < 4; i++) {
    osc.frequency.linearRampToValueAtTime(hi, now + 0.2 + i * 0.35);
    osc.frequency.linearRampToValueAtTime(lo, now + 0.35 + i * 0.35);
  }
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 1.5);
}

function playLaser() {
  const c = audio();
  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1600 * jitter(0.1) * pitchRatio, now);
  osc.frequency.exponentialRampToValueAtTime(80 * pitchRatio, now + 0.28);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playRiser() {
  const c = audio();
  const now = c.currentTime;
  const dur = 1.1;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(6000, now + dur);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.7 * jitter(0.1), now + dur);
  gain.gain.linearRampToValueAtTime(0, now + dur + 0.08);

  src.connect(filter).connect(gain).connect(master!);
  src.start(now);
  src.stop(now + dur + 0.1);
}

function playDrop() {
  const c = audio();
  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180 * jitter(0.08) * pitchRatio, now);
  osc.frequency.exponentialRampToValueAtTime(30 * pitchRatio, now + 0.65);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.7);
}

function playVinylStop() {
  const c = audio();
  const now = c.currentTime;
  const dur = 1.1;
  const gain = c.createGain();
  gain.connect(master!);
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
}

function playReverse() {
  const c = audio();
  const now = c.currentTime;
  const dur = 0.6;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 4000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.6 * jitter(0.1), now + dur);
  gain.gain.linearRampToValueAtTime(0, now + dur + 0.05);
  src.connect(filter).connect(gain).connect(master!);
  src.start(now);
  src.stop(now + dur + 0.1);
}

function playSnare(startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;

  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1500;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  src.connect(filter).connect(noiseGain).connect(master!);
  src.start(now);
  src.stop(now + 0.18);

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 190 * pitchRatio;
  const toneGain = c.createGain();
  toneGain.gain.setValueAtTime(0.4, now);
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(toneGain).connect(master!);
  osc.start(now);
  osc.stop(now + 0.14);
}

function playScratch() {
  const c = audio();
  const now = c.currentTime;
  const dur = 0.5;
  const src = noiseSource();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 6;

  const gain = c.createGain();
  src.connect(filter).connect(gain).connect(master!);

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

function playClap(startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  // A clap is a few overlapping noise bursts, each highpassed and short.
  const offsets = [0, 0.01, 0.02, 0.03, 0.11];
  for (const offset of offsets) {
    const t = now + offset;
    const src = noiseSource();
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000 * jitter(0.15);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(filter).connect(gain).connect(master!);
    src.start(t);
    src.stop(t + 0.1);
  }
}

function playHatRoll() {
  const c = audio();
  const now = c.currentTime;
  const hits = 8;
  for (let i = 0; i < hits; i++) {
    const t = now + i * 0.045;
    const src = noiseSource();
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7500;
    const gain = c.createGain();
    const level = 0.28 * (1 - i / (hits + 2));
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(filter).connect(gain).connect(master!);
    src.start(t);
    src.stop(t + 0.04);
  }
}

function playStab() {
  const c = audio();
  const now = c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  const base = 392 * pitchRatio * jitter(0.02);
  for (const ratio of [1, 1.25, 1.5]) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = base * ratio;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

function playWobble() {
  const c = audio();
  const now = c.currentTime;
  const dur = 0.9;

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 65 * pitchRatio;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 8;
  filter.frequency.value = 600;

  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 6;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 800;
  lfo.connect(lfoGain).connect(filter.frequency);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.setValueAtTime(0.7, now + dur - 0.1);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(filter).connect(gain).connect(master!);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + dur + 0.05);
  lfo.stop(now + dur + 0.05);
}

// The beat machine's own two voices — not pad sounds, so each takes an
// optional scheduled start time rather than always firing at "now".
function playKick(startTime?: number) {
  const c = audio();
  const now = startTime ?? c.currentTime;
  const gain = c.createGain();
  gain.connect(master!);
  gain.gain.setValueAtTime(1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150 * pitchRatio, now);
  osc.frequency.exponentialRampToValueAtTime(45 * pitchRatio, now + 0.15);
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

const SOUNDS: Record<PadId, () => void> = {
  horn: playHorn,
  siren: playSiren,
  laser: playLaser,
  riser: playRiser,
  drop: playDrop,
  vinylstop: playVinylStop,
  reverse: playReverse,
  snare: playSnare,
  clap: playClap,
  hatroll: playHatRoll,
  stab: playStab,
  wobble: playWobble,
};

let glow: GlowSource | null = null;
let glowUntil = 0;

function trigger(pad: HTMLButtonElement, opts: { announce?: boolean } = {}) {
  const { announce = true } = opts;
  const sound = pad.dataset.sound as PadId | undefined;
  if (!sound) return;
  SOUNDS[sound]();

  pad.classList.add("hit");
  setTimeout(() => pad.classList.remove("hit"), 140);

  glow = sound;
  glowUntil = performance.now() + 900;

  if (announce && statusEl) statusEl.textContent = `Playing: ${LABELS[sound]}`;

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

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  const pad = pads.find((p) => p.dataset.key === e.key);
  if (pad && document.activeElement !== pad) trigger(pad);
});

// --- the jog platter: click, tap or Enter/Space plays a random scratch move ---
const jog = document.getElementById("jog") as HTMLButtonElement | null;

jog?.addEventListener("click", () => {
  playScratch();
  jog.classList.remove("scratching");
  void jog.offsetWidth; // restart the wobble animation on repeat hits
  jog.classList.add("scratching");
  setTimeout(() => jog.classList.remove("scratching"), 600);

  glow = "jog";
  glowUntil = performance.now() + 900;
  if (statusEl) statusEl.textContent = "Spun the jog wheel — scratching.";
});

// --- channel strip: volume and pitch faders ---
const volumeSlider = document.getElementById("volume") as HTMLInputElement | null;
volumeSlider?.addEventListener("input", () => {
  masterVolume = Number(volumeSlider.value);
  if (master) master.gain.value = masterVolume;
});

const pitchSlider = document.getElementById("pitch") as HTMLInputElement | null;
const pitchLabel = document.getElementById("pitch-label");
const bpmLabel = document.getElementById("bpm-label");

function updateBpmLabel() {
  if (bpmLabel) bpmLabel.textContent = `${Math.round(BPM * pitchRatio)} BPM`;
}

pitchSlider?.addEventListener("input", () => {
  const percent = Number(pitchSlider.value);
  pitchRatio = 1 + percent / 100;
  if (pitchLabel) pitchLabel.textContent = `${percent > 0 ? "+" : ""}${percent}%`;
  updateBpmLabel();
});

// --- the beat machine: a scheduled 8-step loop, kick/hat/snare, 128 BPM ---
const beatsBtn = document.getElementById("beats-btn") as HTMLButtonElement | null;
const beatsBtnText = beatsBtn?.querySelector<HTMLSpanElement>(".btn-text") ?? null;
const cueBtn = document.getElementById("cue-btn") as HTMLButtonElement | null;
const BPM = 128;
const STEP_SECONDS = 60 / BPM / 2;
const STEPS = 8;
const KICK_STEPS = new Set([0, 4]);
const SNARE_STEPS = new Set([2, 6]);

let beatsOn = false;
let beatSchedulerId: number | null = null;
let nextStepTime = 0;
let stepIndex = 0;

function scheduleStep(step: number, time: number) {
  playHat(time);
  if (KICK_STEPS.has(step)) playKick(time);
  if (SNARE_STEPS.has(step)) playSnare(time);
}

function beatTick() {
  const c = audio();
  const stepDuration = STEP_SECONDS / pitchRatio;
  while (nextStepTime < c.currentTime + 0.12) {
    scheduleStep(stepIndex, nextStepTime);
    nextStepTime += stepDuration;
    stepIndex = (stepIndex + 1) % STEPS;
  }
}

function startBeats() {
  const c = audio();
  stepIndex = 0;
  nextStepTime = c.currentTime + 0.05;
  beatSchedulerId = window.setInterval(beatTick, 25);
  beatsOn = true;
}

function stopBeats() {
  if (beatSchedulerId !== null) clearInterval(beatSchedulerId);
  beatSchedulerId = null;
  beatsOn = false;
}

// --- the looper: record what you play on the pads; Play beat plays it back ---
const recordBtn = document.getElementById("record-btn") as HTMLButtonElement | null;
const recordBtnText = recordBtn?.querySelector<HTMLSpanElement>(".btn-text") ?? null;
const recordTimerEl = document.getElementById("record-timer");
const MAX_RECORD_MS = 8000;

let recording = false;
let recordStart = 0;
let recordedHits: { sound: PadId; t: number }[] = [];
let recordedDuration = 0;
let recordStopTimer: number | null = null;
let recordTimerInterval: number | null = null;
let playbackActive = false;
let playbackTimers: number[] = [];

function updateBeatsBtnLabel() {
  if (!beatsBtnText) return;
  beatsBtnText.textContent = recordedHits.length > 0 ? "Play loop" : "Play beat";
}

function stopPlayback() {
  playbackActive = false;
  for (const timer of playbackTimers) clearTimeout(timer);
  playbackTimers = [];
  beatsBtn?.setAttribute("aria-pressed", "false");
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
  beatsBtn?.setAttribute("aria-pressed", "true");
}

beatsBtn?.addEventListener("click", () => {
  audio();
  const hasRecording = recordedHits.length > 0;
  if (hasRecording) {
    if (playbackActive) {
      stopPlayback();
      if (statusEl) statusEl.textContent = "Stopped your recorded loop.";
    } else {
      startPlayback();
      if (statusEl) statusEl.textContent = "Playing back what you recorded.";
    }
    return;
  }
  if (beatsOn) {
    stopBeats();
    beatsBtn.setAttribute("aria-pressed", "false");
    if (statusEl) statusEl.textContent = "Beat stopped.";
  } else {
    startBeats();
    beatsBtn.setAttribute("aria-pressed", "true");
    if (statusEl) statusEl.textContent = "Beat running.";
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
  if (statusEl) statusEl.textContent = "Recording your loop — up to 8s of pads.";
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
  updateBeatsBtnLabel();
  if (statusEl) {
    statusEl.textContent = recordedHits.length
      ? `Captured ${recordedHits.length} hit${recordedHits.length === 1 ? "" : "s"} — press Play beat to replay them.`
      : "Recording stopped — nothing captured.";
  }
}

recordBtn?.addEventListener("click", () => {
  audio();
  if (recording) stopRecording();
  else startRecording();
});

// --- cue: press and hold to preview the beat quietly and jump back on release ---
let cueWasTemporary = false;

function cueDown() {
  audio();
  if (beatsOn) {
    stepIndex = 0;
    nextStepTime = audio().currentTime + 0.02;
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

updateBpmLabel();
updateBeatsBtnLabel();

// Visualiser: a frequency-bar deck that runs continuously, rainbow-tinted,
// with the most recently hit pad's colour (or the jog's) glowing at the centre.
if (canvas) {
  const ctx2d = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx2d.scale(dpr, dpr);

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

    if (glow && performance.now() < glowUntil) {
      const remaining = (glowUntil - performance.now()) / 900;
      ctx2d.save();
      ctx2d.globalAlpha = remaining * 0.5;
      ctx2d.fillStyle = colorFor(glow);
      ctx2d.beginPath();
      ctx2d.ellipse(w / 2, h / 2, w * 0.4 * remaining + 20, h * 0.5, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.restore();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
