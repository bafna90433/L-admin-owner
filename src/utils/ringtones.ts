/**
 * Ringtones for the Announcement Bell.
 *
 * The tones are synthesised in the browser rather than downloaded, so a ring
 * starts the instant it arrives — no file fetch, no cache miss, no assets to
 * deploy. A staff member can also be given an uploaded mp3 instead.
 *
 * Browsers refuse to play audio until the person has interacted with the page,
 * so `unlockAudio()` must be called from a real click (the login button does
 * it). After that the tone plays whenever the MD rings.
 */

export type ToneId =
  | 'chime'
  | 'bell'
  | 'ping'
  | 'alert'
  | 'arcade'
  | 'digital'
  | 'marimba'
  | 'siren'
  | 'custom';

export interface ToneMeta {
  id: ToneId;
  name: string;
  hint: string;
}

export const TONES: ToneMeta[] = [
  { id: 'chime', name: 'Office Chime', hint: 'Soft two-note chime' },
  { id: 'bell', name: 'Brass Bell', hint: 'Classic reception bell' },
  { id: 'ping', name: 'Sharp Ping', hint: 'Short and bright' },
  { id: 'alert', name: 'Alert Pulse', hint: 'Repeating urgent beeps' },
  { id: 'arcade', name: 'Rising Arcade', hint: 'Playful upward run' },
  { id: 'digital', name: 'Digital Ring', hint: 'Telephone style ring' },
  { id: 'marimba', name: 'Marimba', hint: 'Warm wooden notes' },
  { id: 'siren', name: 'Soft Siren', hint: 'Slow rise and fall' }
];

/** One note in a tone: when it starts, what pitch, how long, how loud. */
interface Note {
  at: number;
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Slide to this pitch over the note's length. */
  to?: number;
}

interface ToneSpec {
  notes: Note[];
  /** How long one pass lasts, so repeats line up cleanly. */
  length: number;
}

const SPECS: Record<Exclude<ToneId, 'custom'>, ToneSpec> = {
  chime: {
    length: 1.1,
    notes: [
      { at: 0, freq: 880, dur: 0.45, type: 'sine', gain: 0.5 },
      { at: 0.18, freq: 1174.7, dur: 0.6, type: 'sine', gain: 0.45 },
      { at: 0.18, freq: 2349.3, dur: 0.5, type: 'sine', gain: 0.12 }
    ]
  },
  bell: {
    length: 1.5,
    notes: [
      { at: 0, freq: 1046.5, dur: 1.2, type: 'sine', gain: 0.5 },
      { at: 0, freq: 2093, dur: 0.9, type: 'sine', gain: 0.18 },
      { at: 0, freq: 3139.5, dur: 0.5, type: 'sine', gain: 0.08 },
      { at: 0.5, freq: 1046.5, dur: 0.9, type: 'sine', gain: 0.3 }
    ]
  },
  ping: {
    length: 0.7,
    notes: [
      { at: 0, freq: 1568, dur: 0.12, type: 'triangle', gain: 0.5 },
      { at: 0.11, freq: 2093, dur: 0.35, type: 'sine', gain: 0.4 }
    ]
  },
  alert: {
    length: 1.4,
    notes: [
      { at: 0, freq: 990, dur: 0.14, type: 'square', gain: 0.28 },
      { at: 0.22, freq: 990, dur: 0.14, type: 'square', gain: 0.28 },
      { at: 0.44, freq: 990, dur: 0.14, type: 'square', gain: 0.28 },
      { at: 0.7, freq: 1320, dur: 0.3, type: 'square', gain: 0.3 }
    ]
  },
  arcade: {
    length: 1.0,
    notes: [
      { at: 0, freq: 523.3, dur: 0.11, type: 'square', gain: 0.26 },
      { at: 0.1, freq: 659.3, dur: 0.11, type: 'square', gain: 0.26 },
      { at: 0.2, freq: 784, dur: 0.11, type: 'square', gain: 0.26 },
      { at: 0.3, freq: 1046.5, dur: 0.35, type: 'square', gain: 0.3 }
    ]
  },
  digital: {
    length: 1.6,
    notes: [
      { at: 0, freq: 1200, dur: 0.09, type: 'sine', gain: 0.4 },
      { at: 0.12, freq: 1600, dur: 0.09, type: 'sine', gain: 0.4 },
      { at: 0.24, freq: 1200, dur: 0.09, type: 'sine', gain: 0.4 },
      { at: 0.36, freq: 1600, dur: 0.09, type: 'sine', gain: 0.4 },
      { at: 0.8, freq: 1200, dur: 0.09, type: 'sine', gain: 0.34 },
      { at: 0.92, freq: 1600, dur: 0.09, type: 'sine', gain: 0.34 }
    ]
  },
  marimba: {
    length: 1.3,
    notes: [
      { at: 0, freq: 587.3, dur: 0.4, type: 'triangle', gain: 0.5 },
      { at: 0.16, freq: 880, dur: 0.4, type: 'triangle', gain: 0.45 },
      { at: 0.32, freq: 1174.7, dur: 0.6, type: 'triangle', gain: 0.4 }
    ]
  },
  siren: {
    length: 1.8,
    notes: [
      { at: 0, freq: 620, to: 980, dur: 0.7, type: 'sine', gain: 0.35 },
      { at: 0.7, freq: 980, to: 620, dur: 0.7, type: 'sine', gain: 0.35 }
    ]
  }
};

type Ctx = AudioContext & { __unlocked?: boolean };

let ctx: Ctx | null = null;

const getCtx = (): Ctx | null => {
  if (ctx) return ctx;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor() as Ctx;
  return ctx;
};

/**
 * Call this from a real click. It wakes the audio engine and plays a silent
 * blip, which is what actually lifts the browser's autoplay block.
 */
export const unlockAudio = async (): Promise<boolean> => {
  const audio = getCtx();
  if (!audio) return false;
  try {
    if (audio.state === 'suspended') await audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.03);
    audio.__unlocked = true;
    return true;
  } catch {
    return false;
  }
};

/** True once the browser will actually let a tone play. */
export const isAudioReady = (): boolean => {
  const audio = getCtx();
  return Boolean(audio && audio.state === 'running' && audio.__unlocked);
};

export interface PlayOptions {
  /** An uploaded mp3 to use instead of a synthesised tone. */
  customUrl?: string;
  /** How many times the tone repeats before stopping on its own. */
  repeat?: number;
  volume?: number;
}

/** Plays a tone and hands back a function that stops it early. */
export const playTone = (tone: ToneId, options: PlayOptions = {}): (() => void) => {
  const { customUrl = '', repeat = 1, volume = 1 } = options;

  if (tone === 'custom' && customUrl) {
    const el = new Audio(customUrl);
    el.volume = Math.min(1, Math.max(0, volume));
    let plays = 0;
    el.addEventListener('ended', () => {
      plays++;
      if (plays < repeat) {
        el.currentTime = 0;
        void el.play().catch(() => undefined);
      }
    });
    void el.play().catch(() => undefined);
    return () => {
      el.pause();
      el.currentTime = 0;
    };
  }

  const audio = getCtx();
  const spec = SPECS[(tone === 'custom' ? 'chime' : tone) as Exclude<ToneId, 'custom'>];
  if (!audio || !spec) return () => undefined;

  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);

  const master = audio.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume));
  master.connect(audio.destination);

  const started: OscillatorNode[] = [];
  const base = audio.currentTime + 0.02;

  for (let pass = 0; pass < Math.max(1, repeat); pass++) {
    const offset = base + pass * (spec.length + 0.15);
    for (const note of spec.notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = offset + note.at;
      const end = start + note.dur;
      const peak = note.gain ?? 0.4;

      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, start);
      if (note.to) osc.frequency.linearRampToValueAtTime(note.to, end);

      // A quick attack and a soft tail — square edges click, this does not.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
      started.push(osc);
    }
  }

  return () => {
    for (const osc of started) {
      try {
        osc.stop();
      } catch {
        // Already finished — nothing to stop.
      }
    }
    try {
      master.disconnect();
    } catch {
      // Context torn down.
    }
  };
};

/** One short pass, for the preview buttons in the MD panel. */
export const previewTone = (tone: ToneId, customUrl = '') =>
  playTone(tone, { customUrl, repeat: 1 });
