/**
 * Tiny Web Audio API synthesiser utilities for interaction feedback.
 * No audio files needed — all sounds are generated programmatically.
 */

type OscType = OscillatorType;

function synth(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  gainPeak: number,
  oscType: OscType = 'sine',
) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = oscType;
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + durationSec);

    gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSec);
  } catch {
    // Silently ignore — AudioContext may be blocked or unavailable
  }
}

/** "Pop" ascending tone for liking a post / reel. */
export function playLikeSound() {
  synth(660, 1320, 0.18, 0.22, 'sine');
}

/** Double-note rising chord for following someone. */
export function playFollowSound() {
  synth(440, 880, 0.22, 0.18, 'sine');
  setTimeout(() => synth(660, 1100, 0.18, 0.12, 'sine'), 70);
}
