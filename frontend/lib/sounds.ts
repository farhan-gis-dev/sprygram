/**
 * Lightweight sound effects using the Web Audio API.
 * No external files needed — all sounds are synthesised in-browser.
 */

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  startTime: number,
  gainValue: number,
  ctx: AudioContext,
  type: OscillatorType = 'sine',
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/** Short two-tone pop played when liking a post (like). */
export function playLikeSound(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(880, 0.08, now, 0.12, ctx, 'sine');
  playTone(1100, 0.12, now + 0.06, 0.09, ctx, 'sine');
}

/** Warm ascending chime played when following someone. */
export function playFollowSound(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(660, 0.10, now, 0.10, ctx, 'sine');
  playTone(880, 0.10, now + 0.08, 0.10, ctx, 'sine');
  playTone(1100, 0.15, now + 0.16, 0.08, ctx, 'sine');
}

/** Soft click/tick for UI interactions (send message, react, etc.). */
export function playClickSound(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(1200, 0.04, now, 0.07, ctx, 'sine');
}
