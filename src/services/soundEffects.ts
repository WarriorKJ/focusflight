/**
 * Procedural Web Audio API sound synthesis.
 * Zero external audio files, works offline, zero 404 risk.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Authentic Airline In-Flight Chime ("Ding - Dong")
 * Used for boarding alerts, seatbelt sign, and weather updates.
 */
export function playCabinChime(type: 'dingdong' | 'single' = 'dingdong') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // First chime: 880 Hz (A5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(860, now + 0.8);

  // Soft harmonics
  const osc1b = ctx.createOscillator();
  const gain1b = ctx.createGain();
  osc1b.type = 'triangle';
  osc1b.frequency.setValueAtTime(1760, now);

  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.28, now + 0.04);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

  gain1b.gain.setValueAtTime(0, now);
  gain1b.gain.linearRampToValueAtTime(0.06, now + 0.03);
  gain1b.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  osc1.connect(gain1);
  osc1b.connect(gain1b);
  gain1.connect(ctx.destination);
  gain1b.connect(ctx.destination);

  osc1.start(now);
  osc1b.start(now);
  osc1.stop(now + 1.0);
  osc1b.stop(now + 0.7);

  if (type === 'dingdong') {
    // Second chime: 587.3 Hz (D5) - traditional airline interval
    const chime2Time = now + 0.42;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, chime2Time);
    osc2.frequency.exponentialRampToValueAtTime(575, chime2Time + 1.2);

    const osc2b = ctx.createOscillator();
    const gain2b = ctx.createGain();
    osc2b.type = 'triangle';
    osc2b.frequency.setValueAtTime(1174.66, chime2Time);

    gain2.gain.setValueAtTime(0, chime2Time);
    gain2.gain.linearRampToValueAtTime(0.24, chime2Time + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, chime2Time + 1.4);

    gain2b.gain.setValueAtTime(0, chime2Time);
    gain2b.gain.linearRampToValueAtTime(0.05, chime2Time + 0.03);
    gain2b.gain.exponentialRampToValueAtTime(0.0001, chime2Time + 0.9);

    osc2.connect(gain2);
    osc2b.connect(gain2b);
    gain2.connect(ctx.destination);
    gain2b.connect(ctx.destination);

    osc2.start(chime2Time);
    osc2b.start(chime2Time);
    osc2.stop(chime2Time + 1.5);
    osc2b.stop(chime2Time + 1.0);
  }
}

/**
 * Procedural paper tear / rip sound effect for the boarding pass stub.
 */
export function playPaperTearSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.38;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate crackly noise
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Crackle burst amplitude
    const progress = i / bufferSize;
    const burst = Math.sin(progress * Math.PI) * (Math.random() > 0.4 ? 1 : 0.2);
    // Brown-ish integration
    lastOut = (lastOut + 0.05 * white) / 1.05;
    data[i] = (lastOut * 0.7 + white * 0.3) * burst;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.linearRampToValueAtTime(2600, now + duration * 0.5);
  filter.frequency.linearRampToValueAtTime(800, now + duration);
  filter.Q.value = 1.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/**
 * Touchdown celebration fanfare / chord
 */
export function playTouchdownFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const chords = [523.25, 659.25, 783.99, 1046.5]; // C major chord
  const now = ctx.currentTime;

  chords.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    const startTime = now + idx * 0.08;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 2.2);
  });
}

/**
 * Cabin Jet Engine White Noise generator for focus
 */
class CabinNoiseEngine {
  private noiseNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;

  public start(volume: number = 0.25) {
    if (this.isPlaying) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 4; // 4 second loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Pink / Brown engine rumble noise generator
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filter to sound like airplane cabin interior
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    this.noiseNode = source;
    this.gainNode = gain;
    this.isPlaying = true;
  }

  public stop() {
    if (!this.isPlaying || !this.gainNode) return;
    const ctx = getAudioContext();
    if (ctx) {
      this.gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      setTimeout(() => {
        try {
          this.noiseNode?.stop();
          this.noiseNode?.disconnect();
          this.isPlaying = false;
        } catch {
          // ignore
        }
      }, 500);
    }
  }

  public setVolume(vol: number) {
    if (this.gainNode && audioCtx) {
      this.gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
  }

  public getStatus() {
    return this.isPlaying;
  }
}

export const cabinNoise = new CabinNoiseEngine();
