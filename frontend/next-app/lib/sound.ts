/**
 * EduAccess AI — Subtle Web Audio UI Feedback Synthesizer
 * 
 * Provides lightweight, non-intrusive, zero-asset audio clicks and micro-chimes
 * for the Video Interaction Layer. Does not mute or interfere with video audio.
 */

let audioCtx: AudioContext | null = null;
let lastClickTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a subtle, premium UI click sound.
 * @param volume Volume multiplier between 0 and 1 (default: 0.07 for quiet subtlety)
 */
export function playInteractionClick(volume = 0.07): void {
  const now = Date.now();
  if (now - lastClickTime < 180) return; // Prevent duplicate rapid clicks
  lastClickTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Quick, soft pitch drop (1200Hz -> 600Hz in 14ms)
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.015);

    gain.gain.setValueAtTime(Math.min(volume, 0.12), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    // Graceful fallback if audio context is blocked
  }
}

/**
 * Play a gentle AI/Accessibility event chime (e.g. when an insight or disparity pops).
 */
export function playEventChime(volume = 0.05): void {
  const now = Date.now();
  if (now - lastClickTime < 250) return;
  lastClickTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(Math.min(volume, 0.08), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.075);
  } catch {
    // Graceful fallback
  }
}
