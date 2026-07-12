/** Vibration API support varies a lot (no iOS Safari, most Android browsers do) — always
 * feature-detect rather than gating on touch/platform, and fail silently either way. */
function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // best-effort only
  }
}

export function vibrateFound() {
  vibrate(15);
}

export function vibrateMiss() {
  vibrate([15, 40, 15]);
}

export function vibrateClear() {
  vibrate([20, 30, 20, 30, 40]);
}
