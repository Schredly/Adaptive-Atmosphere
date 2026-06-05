/**
 * demoSynth — a tiny Web Audio engine that gives the *demo* music mode real,
 * adaptive sound with no login, no audio assets, and no licensing.
 *
 * Instead of streaming files, it synthesizes a living bed — a chord pad plus a
 * rhythm section (kick / hats / snare / bass) — whose key, brightness, tempo and
 * busyness map to the current energy bucket. Switching buckets retunes the pad
 * and swaps the drum pattern, so the orchestration engine's transitions are
 * actually audible.
 *
 * Browsers block audio until a user gesture, so the AudioContext starts
 * suspended and is unlocked on the first pointer/key/touch interaction (the
 * now-playing play button works too, since that's a gesture).
 */

import type { MusicBucket } from "@/types/spotify";

type Program = {
  /** Pad root frequency (Hz). */
  root: number;
  /** Pad oscillator timbre. */
  wave: OscillatorType;
  /** Base lowpass cutoff for the pad (Hz). */
  cutoff: number;
  /** Pad level (0..1). */
  pad: number;
  /** Bass timbre + level. */
  bassWave: OscillatorType;
  bass: number;
  /** 16-step velocities (0 = silent). */
  kick: number[];
  hat: number[];
  snare: number[];
  /** Swing amount on off-steps (0..1). */
  swing: number;
};

const P = (v: number, steps: number[]): number[] => {
  const a = new Array(16).fill(0);
  for (const s of steps) a[s] = v;
  return a;
};

// Per-bucket musical character. Roots climb and timbres brighten with energy.
const PROGRAMS: Record<MusicBucket, Program> = {
  ambient: {
    root: 110.0, wave: "sine", cutoff: 600, pad: 0.5, bassWave: "sine", bass: 0.0,
    kick: P(0.25, [0]), hat: P(0, []), snare: P(0, []), swing: 0,
  },
  chill: {
    root: 130.81, wave: "triangle", cutoff: 900, pad: 0.42, bassWave: "triangle", bass: 0.28,
    kick: P(0.7, [0, 8]), hat: P(0.18, [4, 12]), snare: P(0, []), swing: 0.18,
  },
  groove: {
    root: 146.83, wave: "sawtooth", cutoff: 1200, pad: 0.34, bassWave: "sawtooth", bass: 0.34,
    kick: P(0.85, [0, 4, 8, 12]), hat: P(0.2, [2, 6, 10, 14]), snare: P(0.5, [4, 12]), swing: 0.12,
  },
  hype: {
    root: 164.81, wave: "sawtooth", cutoff: 1700, pad: 0.3, bassWave: "sawtooth", bass: 0.4,
    kick: P(0.95, [0, 4, 8, 12]), hat: P(0.24, [0, 2, 4, 6, 8, 10, 12, 14]), snare: P(0.55, [4, 12]), swing: 0.06,
  },
  intense: {
    root: 174.61, wave: "sawtooth", cutoff: 2300, pad: 0.26, bassWave: "square", bass: 0.42,
    kick: P(1.0, [0, 4, 8, 12]), hat: P(0.22, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), snare: P(0.6, [4, 12]), swing: 0,
  },
  chaotic: {
    root: 196.0, wave: "square", cutoff: 3000, pad: 0.22, bassWave: "square", bass: 0.45,
    kick: P(1.0, [0, 3, 6, 8, 11, 14]), hat: P(0.26, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), snare: P(0.7, [4, 10, 12]), swing: 0,
  },
};

// Minor-ish chord intervals (semitones) for the pad.
const CHORD = [0, 3, 7, 12];
const semi = (hz: number, n: number) => hz * Math.pow(2, n / 12);

export class DemoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  // Persistent pad voices (retuned on bucket change for a smooth morph).
  private padOscs: OscillatorNode[] = [];
  private padFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;
  private padLfo: OscillatorNode | null = null;

  private program: Program = PROGRAMS.ambient;
  private bpm = 96;
  private bucket: MusicBucket = "ambient";

  private step = 0;
  private nextStepTime = 0;
  private schedulerId: number | null = null;

  private volume = 0.8;
  private muted = false;
  private playing = false;
  private unlockBound = false;
  private wasRunning = false;

  /** Fired when the AudioContext transitions running ↔ suspended. */
  onEnabledChange: (() => void) | null = null;

  /** True once the browser has actually unlocked audio output. */
  get enabled(): boolean {
    return this.ctx?.state === "running";
  }

  // ── Public API ───────────────────────────────────────────────

  /** Select the bucket + tempo; retunes the pad and swaps the drum pattern. */
  setProgram(bucket: MusicBucket, bpm: number): void {
    this.bucket = bucket;
    this.program = PROGRAMS[bucket] ?? PROGRAMS.ambient;
    this.bpm = Math.max(40, bpm || 96);
    this.retunePad();
  }

  /** Start (or keep) playing the current program. */
  play(): void {
    this.playing = true;
    this.ensureContext();
    this.bindUnlock();
    void this.ctx?.resume();
    this.ensurePad();
    this.applyVolume(0.04);
    if (this.schedulerId === null && this.ctx) {
      this.step = 0;
      this.nextStepTime = this.ctx.currentTime + 0.06;
      this.schedulerId = window.setInterval(() => this.scheduler(), 25);
    }
  }

  resume(): void {
    this.play();
  }

  /**
   * Explicitly unlock audio from a user gesture without changing play/pause
   * intent — used by the "Enable sound" affordance. The AudioContext can only
   * leave "suspended" inside a gesture, which a button click satisfies.
   */
  unlock(): void {
    this.ensureContext();
    this.bindUnlock();
    void this.ctx?.resume().then(() => this.notifyIfRunning());
    if (this.playing) {
      this.ensurePad();
      this.applyVolume(0.2);
    }
    this.notifyIfRunning();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume(0.08);
  }

  /** Stop the rhythm and fade the pad out. */
  pause(fadeMs = 120): void {
    this.playing = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.padGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setValueAtTime(this.padGain.gain.value, t);
      this.padGain.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.02, fadeMs / 1000));
    }
  }

  setVolume(v01: number): void {
    this.volume = Math.max(0, Math.min(1, v01));
    this.applyVolume(0.08);
  }

  destroy(): void {
    if (this.schedulerId !== null) clearInterval(this.schedulerId);
    this.schedulerId = null;
    this.padOscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    this.padOscs = [];
    try { this.padLfo?.stop(); } catch { /* noop */ }
    this.padLfo = null;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.padGain = null;
    this.padFilter = null;
  }

  // ── Context / graph ──────────────────────────────────────────

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    // master → soft compressor → out (glue + clip protection).
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // One reusable white-noise buffer for percussion.
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  /** Unlock audio on the first user gesture (browser autoplay policy). */
  private bindUnlock(): void {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;
    const unlock = () => {
      void this.ctx?.resume().then(() => this.notifyIfRunning());
      if (this.ctx && this.ctx.state === "running") {
        this.applyVolume(0.2);
        this.notifyIfRunning();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
  }

  private applyVolume(ramp = 0.05): void {
    if (!this.master || !this.ctx) return;
    const target = this.playing && !this.muted ? this.volume * 0.5 : 0.0001;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.linearRampToValueAtTime(Math.max(0.0001, target), t + ramp);
  }

  /** Detect running↔suspended transitions and notify listeners (for the UI). */
  private notifyIfRunning(): void {
    const running = this.ctx?.state === "running";
    if (running !== this.wasRunning) {
      this.wasRunning = running;
      this.onEnabledChange?.();
    }
  }

  private ensurePad(): void {
    if (!this.ctx || !this.master || this.padOscs.length) {
      // Already built — just make sure it's audible again after a pause.
      if (this.padGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.padGain.gain.cancelScheduledValues(t);
        this.padGain.gain.linearRampToValueAtTime(this.program.pad, t + 0.6);
      }
      return;
    }
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = this.program.cutoff;
    this.padFilter.Q.value = 6;

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0001;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.master);

    // Slow filter movement so the pad breathes.
    this.padLfo = ctx.createOscillator();
    this.padLfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = this.program.cutoff * 0.4;
    this.padLfo.connect(lfoGain);
    lfoGain.connect(this.padFilter.frequency);
    this.padLfo.start();

    for (const interval of CHORD) {
      const osc = ctx.createOscillator();
      osc.type = this.program.wave;
      osc.frequency.value = semi(this.program.root, interval);
      osc.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.value = 1 / CHORD.length;
      osc.connect(g);
      g.connect(this.padFilter);
      osc.start();
      this.padOscs.push(osc);
    }
    const t = ctx.currentTime;
    this.padGain.gain.linearRampToValueAtTime(this.program.pad, t + 0.8);
  }

  private retunePad(): void {
    if (!this.ctx || !this.padOscs.length || !this.padFilter || !this.padGain) return;
    const t = this.ctx.currentTime;
    const glide = 0.5;
    this.padOscs.forEach((osc, i) => {
      const f = semi(this.program.root, CHORD[i % CHORD.length]);
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(osc.frequency.value, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f), t + glide);
      osc.type = this.program.wave;
    });
    this.padFilter.frequency.cancelScheduledValues(t);
    this.padFilter.frequency.linearRampToValueAtTime(this.program.cutoff, t + glide);
    this.padGain.gain.linearRampToValueAtTime(this.program.pad, t + glide);
  }

  // ── Sequencer ────────────────────────────────────────────────

  private scheduler(): void {
    if (!this.ctx) return;
    this.notifyIfRunning(); // catch the async resume → running transition
    const stepDur = 60 / this.bpm / 4; // 16th notes
    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const prog = this.program;
    const swing = step % 2 === 1 ? prog.swing * (60 / this.bpm / 4) * 0.35 : 0;
    const at = time + swing;
    if (prog.kick[step]) this.kick(at, prog.kick[step]);
    if (prog.hat[step]) this.hat(at, prog.hat[step]);
    if (prog.snare[step]) this.snare(at, prog.snare[step]);
    if (prog.bass > 0 && step % 4 === 0) {
      const note = step === 0 ? prog.root / 2 : semi(prog.root / 2, CHORD[(step / 4) % CHORD.length]);
      this.bassNote(at, prog.bass, note, (60 / this.bpm) * 0.9);
    }
  }

  private voiceOut(): AudioNode {
    return this.master as AudioNode;
  }

  private kick(time: number, vel: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.11);
    g.gain.setValueAtTime(vel * 0.9, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(g);
    g.connect(this.voiceOut());
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private hat(time: number, vel: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vel * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.voiceOut());
    src.start(time);
    src.stop(time + 0.05);
  }

  private snare(time: number, vel: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vel * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.voiceOut());
    src.start(time);
    src.stop(time + 0.16);
  }

  private bassNote(time: number, vel: number, freq: number, dur: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = this.program.bassWave;
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel * 0.5, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.voiceOut());
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }
}
