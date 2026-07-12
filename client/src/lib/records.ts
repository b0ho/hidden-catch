const STORAGE_PREFIX = 'hidden-catch:best:';

/** Best remaining time at clear, in seconds (bigger = faster clear). */
export function getBestTime(stageId: string): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + stageId);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Records a clear's remaining time. Returns true if it beat the previous best. */
export function saveBestTime(stageId: string, timeLeft: number): boolean {
  const current = getBestTime(stageId);
  if (current !== null && current >= timeLeft) return false;
  try {
    localStorage.setItem(STORAGE_PREFIX + stageId, String(timeLeft));
  } catch {
    // localStorage may be unavailable (private mode/quota) — best-effort only.
  }
  return true;
}

/** A stage counts as cleared once it has any recorded best time. */
export function isCleared(stageId: string): boolean {
  return getBestTime(stageId) !== null;
}

/** How many of a category's stages (1..stageCount) have been cleared at least once. */
export function countClearedInCategory(categoryId: string, stageCount: number): number {
  let count = 0;
  for (let order = 1; order <= stageCount; order += 1) {
    if (isCleared(`${categoryId}-${String(order).padStart(2, '0')}`)) count += 1;
  }
  return count;
}
