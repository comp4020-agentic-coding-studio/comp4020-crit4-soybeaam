// Per-deck audio bus: volume, a two-way filter knob (lowpass sweep left,
// highpass sweep right, flat at centre — the classic DJ-mixer "filter"),
// and delay/reverb sends. Both decks get their own instance so the
// crossfader genuinely blends two independent signal chains, wet tails
// included.

export function makeReverbImpulse(ctx: AudioContext, duration = 1.6, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function makeDriveCurve(amount = 20): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export function panNode(ctx: AudioContext, spread = 0.5): StereoPannerNode {
  const pan = ctx.createStereoPanner();
  pan.pan.value = (Math.random() - 0.5) * 2 * spread;
  return pan;
}

export interface DeckBus {
  input: GainNode;
  setVolume(v: number): void;
  /** -1..1: negative sweeps a lowpass down, positive sweeps a highpass up, ~0 is flat. */
  setFilter(v: number): void;
  setDelaySend(v: number): void;
  setReverbSend(v: number): void;
  /** 0..1 post-fx gain, driven by the crossfader curve. */
  setCrossfade(v: number): void;
}

export function createDeckBus(ctx: AudioContext, master: GainNode): DeckBus {
  const input = ctx.createGain();
  input.gain.value = 0.9;

  const filter = ctx.createBiquadFilter();
  filter.type = "allpass";
  filter.frequency.value = 20000;
  input.connect(filter);

  const crossfade = ctx.createGain();
  crossfade.gain.value = 1;
  crossfade.connect(master);

  // dry path
  filter.connect(crossfade);

  // delay send: a feedback delay tapped after the filter
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.35;
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  filter.connect(delaySend);
  delaySend.connect(delay);
  delay.connect(crossfade);

  // reverb send: a synthetic decaying-noise impulse via ConvolverNode
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  const convolver = ctx.createConvolver();
  convolver.buffer = makeReverbImpulse(ctx);
  filter.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(crossfade);

  function setFilter(v: number) {
    const clamped = Math.max(-1, Math.min(1, v));
    if (clamped < -0.02) {
      filter.type = "lowpass";
      filter.frequency.value = 12000 * Math.pow(2, clamped * 8);
      filter.Q.value = 1 + Math.abs(clamped) * 4;
    } else if (clamped > 0.02) {
      filter.type = "highpass";
      filter.frequency.value = 80 * Math.pow(2, clamped * 8);
      filter.Q.value = 1 + Math.abs(clamped) * 4;
    } else {
      filter.type = "allpass";
      filter.frequency.value = 20000;
      filter.Q.value = 0.7;
    }
  }

  return {
    input,
    setVolume: (v) => (input.gain.value = v),
    setFilter,
    setDelaySend: (v) => (delaySend.gain.value = v),
    setReverbSend: (v) => (reverbSend.gain.value = v),
    setCrossfade: (v) => (crossfade.gain.value = v),
  };
}
