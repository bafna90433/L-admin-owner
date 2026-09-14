/**
 * Ringtones for the Announcement Bell.
 *
 * The tones are synthesised in the browser rather than downloaded, so a ring
 * starts the instant it arrives — no file fetch, no cache miss, no assets to
 * deploy. A staff member can also be given an uploaded mp3 instead.
 *
 * These are meant to carry across a noisy office floor, so they run through a
 * compressor and a hard output boost: loud and siren-like, not a soft notification.
 *
 * Browsers refuse to play audio until the person has interacted with the page,
 * so `unlockAudio()` must be called from a real click (the login button does
 * it). After that the tone plays whenever the MD rings.
 */

export type ToneId =
  | 'telephone'
  | 'siren'
  | 'wail'
  | 'klaxon'
  | 'alert'
  | 'digital'
  | 'bell'
  | 'ping'
  | 'arcade'
  | 'marimba'
  | 'chime'
  | 'custom';

export interface ToneMeta {
  id: ToneId;
  name: string;
  hint: string;
}

export const TONES: ToneMeta[] = [
  { id: 'telephone', name: 'Telephone Ring', hint: 'Classic kring-kring, rings until answered' },
  { id: 'siren', name: 'Emergency Siren', hint: 'Loud rising and falling siren' },
  { id: 'wail', name: 'Two-Tone Wail', hint: 'Ambulance style two-tone' },
  { id: 'klaxon', name: 'Klaxon Horn', hint: 'Deep factory horn' },
  { id: 'alert', name: 'Alert Pulse', hint: 'Fast urgent beeps' },
  { id: 'digital', name: 'Digital Ring', hint: 'Telephone style ring' },
  { id: 'bell', name: 'School Bell', hint: 'Loud metallic bell' },
  { id: 'ping', name: 'Sharp Ping', hint: 'Short and bright' },
  { id: 'arcade', name: 'Rising Arcade', hint: 'Playful upward run' },
  { id: 'marimba', name: 'Marimba', hint: 'Warm wooden notes' },
  { id: 'chime', name: 'Office Chime', hint: 'Soft two-note chime' }
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
  /** Gap before the next pass. Sirens run almost continuously. */
  gap?: number;
  /**
   * Hold each note at full level instead of letting it decay. Alarms need
   * this — a decaying note sounds half as loud as one that holds.
   */
  sustain?: boolean;
}

/**
 * The old desk-phone ring: two metal gongs struck alternately, very fast.
 * That rapid trill is what makes it read as "kring kring" rather than a beep,
 * and there are too many strikes to write out by hand.
 */
const telephoneNotes = (): Note[] => {
  const notes: Note[] = [];
  for (let burst = 0; burst < 2; burst++) {
    const start = burst * 1.15;
    for (let strike = 0; strike < 32; strike++) {
      const at = start + strike * 0.025;
      const freq = strike % 2 === 0 ? 1046 : 1290;
      notes.push({ at, freq, dur: 0.05, type: 'triangle', gain: 0.46 });
      notes.push({ at, freq: freq * 2.7, dur: 0.035, type: 'sine', gain: 0.14 });
    }
  }
  return notes;
};

const SPECS: Record<Exclude<ToneId, 'custom'>, ToneSpec> = {
  telephone: {
    sustain: true,
    length: 2.0,
    // A real phone pauses between double-rings. Kept short so the ring never
    // sounds like it has given up.
    gap: 0.4,
    notes: telephoneNotes()
  },
  // Classic rise-and-fall siren. Sawtooth carries much further than a sine.
  siren: {
    sustain: true,
    length: 2.4,
    gap: 0.05,
    notes: [
      { at: 0, freq: 520, to: 1180, dur: 0.6, type: 'sawtooth', gain: 0.6 },
      { at: 0.6, freq: 1180, to: 520, dur: 0.6, type: 'sawtooth', gain: 0.6 },
      { at: 1.2, freq: 520, to: 1180, dur: 0.6, type: 'sawtooth', gain: 0.6 },
      { at: 1.8, freq: 1180, to: 520, dur: 0.6, type: 'sawtooth', gain: 0.6 }
    ]
  },
  // Ambulance style: two pitches held and swapped.
  wail: {
    sustain: true,
    length: 2.0,
    gap: 0.05,
    notes: [
      { at: 0, freq: 700, dur: 0.48, type: 'square', gain: 0.5 },
      { at: 0.5, freq: 990, dur: 0.48, type: 'square', gain: 0.5 },
      { at: 1.0, freq: 700, dur: 0.48, type: 'square', gain: 0.5 },
      { at: 1.5, freq: 990, dur: 0.48, type: 'square', gain: 0.5 }
    ]
  },
  // Deep horn — cuts through machine noise better than a high tone.
  klaxon: {
    sustain: true,
    length: 1.9,
    gap: 0.1,
    notes: [
      { at: 0, freq: 320, dur: 0.55, type: 'sawtooth', gain: 0.62 },
      { at: 0, freq: 161, dur: 0.55, type: 'square', gain: 0.3 },
      { at: 0.7, freq: 320, dur: 0.55, type: 'sawtooth', gain: 0.62 },
      { at: 0.7, freq: 161, dur: 0.55, type: 'square', gain: 0.3 },
      { at: 1.4, freq: 400, dur: 0.45, type: 'sawtooth', gain: 0.62 }
    ]
  },
  alert: {
    sustain: true,
    length: 1.5,
    gap: 0.12,
    notes: [
      { at: 0, freq: 1040, dur: 0.16, type: 'square', gain: 0.55 },
      { at: 0.24, freq: 1040, dur: 0.16, type: 'square', gain: 0.55 },
      { at: 0.48, freq: 1040, dur: 0.16, type: 'square', gain: 0.55 },
      { at: 0.78, freq: 1390, dur: 0.42, type: 'square', gain: 0.6 }
    ]
  },
  digital: {
    sustain: true,
    length: 1.8,
    gap: 0.15,
    notes: [
      { at: 0, freq: 1200, dur: 0.1, type: 'square', gain: 0.55 },
      { at: 0.13, freq: 1600, dur: 0.1, type: 'square', gain: 0.55 },
      { at: 0.26, freq: 1200, dur: 0.1, type: 'square', gain: 0.55 },
      { at: 0.39, freq: 1600, dur: 0.1, type: 'square', gain: 0.55 },
      { at: 0.85, freq: 1200, dur: 0.1, type: 'square', gain: 0.5 },
      { at: 0.98, freq: 1600, dur: 0.1, type: 'square', gain: 0.5 },
      { at: 1.11, freq: 1200, dur: 0.1, type: 'square', gain: 0.5 },
      { at: 1.24, freq: 1600, dur: 0.1, type: 'square', gain: 0.5 }
    ]
  },
  bell: {
    length: 1.8,
    gap: 0.1,
    notes: [
      { at: 0, freq: 1046.5, dur: 0.9, type: 'triangle', gain: 0.62 },
      { at: 0, freq: 2093, dur: 0.7, type: 'sine', gain: 0.3 },
      { at: 0, freq: 3139.5, dur: 0.4, type: 'sine', gain: 0.16 },
      { at: 0.9, freq: 1046.5, dur: 0.85, type: 'triangle', gain: 0.55 },
      { at: 0.9, freq: 2093, dur: 0.6, type: 'sine', gain: 0.26 }
    ]
  },
  ping: {
    length: 0.8,
    notes: [
      { at: 0, freq: 1568, dur: 0.13, type: 'triangle', gain: 0.6 },
      { at: 0.12, freq: 2093, dur: 0.4, type: 'sine', gain: 0.5 }
    ]
  },
  arcade: {
    length: 1.1,
    notes: [
      { at: 0, freq: 523.3, dur: 0.12, type: 'square', gain: 0.45 },
      { at: 0.11, freq: 659.3, dur: 0.12, type: 'square', gain: 0.45 },
      { at: 0.22, freq: 784, dur: 0.12, type: 'square', gain: 0.45 },
      { at: 0.33, freq: 1046.5, dur: 0.42, type: 'square', gain: 0.5 }
    ]
  },
  marimba: {
    length: 1.4,
    notes: [
      { at: 0, freq: 587.3, dur: 0.42, type: 'triangle', gain: 0.6 },
      { at: 0.17, freq: 880, dur: 0.42, type: 'triangle', gain: 0.55 },
      { at: 0.34, freq: 1174.7, dur: 0.62, type: 'triangle', gain: 0.5 }
    ]
  },
  chime: {
    length: 1.2,
    notes: [
      { at: 0, freq: 880, dur: 0.45, type: 'sine', gain: 0.55 },
      { at: 0.18, freq: 1174.7, dur: 0.6, type: 'sine', gain: 0.5 },
      { at: 0.18, freq: 2349.3, dur: 0.5, type: 'sine', gain: 0.16 }
    ]
  }
};

/** Pushed hard on purpose — this has to be heard across the room. */
const OUTPUT_BOOST = 2.8;

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

    // resume() can resolve while the context is still suspended — that means
    // the browser refused. Saying "true" there would make the caller stop
    // trying, and the bell would stay silent for the rest of the day.
    const allowed = audio.state === 'running';
    audio.__unlocked = allowed;
    return allowed;
  } catch {
    return false;
  }
};

/** True once the browser will actually let a tone play. */
export const isAudioReady = (): boolean => {
  const audio = getCtx();
  return Boolean(audio && audio.state === 'running' && audio.__unlocked);
};

/**
 * Unlock on the person's first interaction anywhere on the page.
 *
 * The login button alone is not enough: a staff member who arrives on a saved
 * session never presses it, so the browser keeps audio blocked all day and the
 * bell stays silent. Any click or keypress will do, so listen for the first one.
 *
 * Returns a function that removes the listeners.
 */
export const armAudioUnlock = (onReady?: (ready: boolean) => void): (() => void) => {
  if (isAudioReady()) {
    onReady?.(true);
    return () => undefined;
  }

  const events: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];

  const remove = () => {
    for (const name of events) document.removeEventListener(name, handler, true);
  };

  const handler = () => {
    void unlockAudio().then(ok => {
      onReady?.(ok);
      // Only stop listening once it actually worked.
      if (ok) remove();
    });
  };

  for (const name of events) document.addEventListener(name, handler, true);
  return remove;
};


export interface PlayOptions {
  /** An uploaded mp3 to use instead of a synthesised tone. */
  customUrl?: string;
  /** How many times the tone repeats before stopping on its own. */
  repeat?: number;
  /** Keep ringing for this long instead of a fixed number of passes. */
  loopMs?: number;
  /** Ring on and on until the returned stop function is called. */
  loop?: boolean;
  volume?: number;
}

/** Plays a tone and hands back a function that stops it early. */
/** Schedules a fixed number of passes and reports how long they will take. */
const scheduleTone = (
  audio: Ctx,
  spec: ToneSpec,
  passes: number,
  volume: number
): { stop: () => void; seconds: number } => {
  // The compressor is what lets the output run this hot without tearing.
  const squash = audio.createDynamicsCompressor();
  squash.threshold.value = -20;
  squash.knee.value = 14;
  squash.ratio.value = 9;
  squash.attack.value = 0.003;
  squash.release.value = 0.2;

  const master = audio.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume)) * OUTPUT_BOOST;
  master.connect(squash).connect(audio.destination);

  const started: OscillatorNode[] = [];
  const base = audio.currentTime + 0.02;
  const stride = spec.length + (spec.gap ?? 0.15);

  for (let pass = 0; pass < passes; pass++) {
    const offset = base + pass * stride;
    for (const note of spec.notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const noteStart = offset + note.at;
      const noteEnd = noteStart + note.dur;
      const peak = note.gain ?? 0.5;

      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, noteStart);
      if (note.to) osc.frequency.linearRampToValueAtTime(note.to, noteEnd);

      // A quick attack stops the click a square edge would make. Alarm tones
      // then hold at full level; musical ones decay away naturally.
      const attack = Math.min(0.012, note.dur * 0.2);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(peak, noteStart + attack);
      if (spec.sustain) {
        const release = Math.min(0.05, note.dur * 0.25);
        gain.gain.setValueAtTime(peak, noteEnd - release);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      } else {
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      }

      osc.connect(gain).connect(master);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.02);
      started.push(osc);
    }
  }

  return {
    seconds: passes * stride,
    stop: () => {
      for (const osc of started) {
        try {
          osc.stop();
        } catch {
          // Already finished — nothing to stop.
        }
      }
      try {
        master.disconnect();
        squash.disconnect();
      } catch {
        // Context torn down.
      }
    }
  };
};

/** Plays a tone and hands back a function that stops it early. */
export const playTone = (tone: ToneId, options: PlayOptions = {}): (() => void) => {
  const { customUrl = '', repeat = 1, loopMs = 0, loop = false, volume = 1 } = options;

  if (tone === 'custom' && customUrl) {
    const el = new Audio(customUrl);
    el.volume = Math.min(1, Math.max(0, volume));
    const until = loopMs ? Date.now() + loopMs : 0;
    let plays = 0;
    el.addEventListener('ended', () => {
      plays++;
      const again = loop || (until ? Date.now() < until : plays < repeat);
      if (again) {
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
  const spec = SPECS[(tone === 'custom' ? 'siren' : tone) as Exclude<ToneId, 'custom'>];
  if (!audio || !spec) return () => undefined;

  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);

  const stride = spec.length + (spec.gap ?? 0.15);

  if (!loop) {
    const passes = loopMs ? Math.max(1, Math.ceil(loopMs / 1000 / stride)) : Math.max(1, repeat);
    return scheduleTone(audio, spec, passes, volume).stop;
  }

  // Ringing until somebody answers. Web Audio needs every note scheduled with a
  // start time, so book a short block at a time and queue the next block just
  // before the current one runs out. A late timer leaves a tiny gap; booking
  // them all up front would instead risk overlap, which sounds far worse.
  let stopped = false;
  let stopBlock: (() => void) | null = null;
  let timer: number | null = null;

  const BLOCK_SECONDS = 8;

  const queueBlock = () => {
    if (stopped) return;
    const passes = Math.max(1, Math.ceil(BLOCK_SECONDS / stride));
    const block = scheduleTone(audio, spec, passes, volume);
    stopBlock = block.stop;
    timer = window.setTimeout(queueBlock, block.seconds * 1000);
  };

  queueBlock();

  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    stopBlock?.();
  };
};

/**
 * Play spoken audio through the same AudioContext as the tones.
 *
 * An <audio> element has its own autoplay gate, so it can stay silent even
 * after the tones are working. Decoding into the unlocked context avoids that
 * second gate entirely.
 */
export const playSpeech = async (
  base64: string,
  options: { repeat?: number; volume?: number } = {}
): Promise<(() => void) | null> => {
  const { repeat = 1, volume = 1 } = options;
  const audio = getCtx();
  if (!audio || !base64) return null;

  try {
    if (audio.state === 'suspended') await audio.resume();

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const buffer = await audio.decodeAudioData(bytes.buffer);
    const gain = audio.createGain();
    gain.gain.value = Math.min(1, Math.max(0, volume));
    gain.connect(audio.destination);

    const sources: AudioBufferSourceNode[] = [];
    const start = audio.currentTime + 0.02;

    // Announcements are said twice, the way they would be over a PA system.
    for (let pass = 0; pass < Math.max(1, repeat); pass++) {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(start + pass * (buffer.duration + 0.35));
      sources.push(source);
    }

    return () => {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already finished.
        }
      }
      try {
        gain.disconnect();
      } catch {
        // Context torn down.
      }
    };
  } catch {
    return null;
  }
};

/** One short pass, for the preview buttons in the MD panel. */
export const previewTone = (tone: ToneId, customUrl = '') =>
  playTone(tone, { customUrl, repeat: 1 });
