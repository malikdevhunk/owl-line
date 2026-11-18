export function formatLength(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function starsFor(length: number, optimal: number): 1 | 2 | 3 {
  if (length <= optimal) return 3;
  if (length * 10 <= optimal * 11) return 2;
  return 1;
}

/**
 * Ascending leaderboard key. Length is in tenths, so one extra tenth of track
 * always ranks worse than any realistic clock time.
 */
export function rankKey(lengthTenths: number, elapsedMs: number): number {
  return lengthTenths * 1_000_000 + elapsedMs;
}

/** More stars first, then less time. Lower is better. */
export function weekKey(starsSum: number, secondsSum: number): number {
  return -starsSum * 1_000_000 + secondsSum;
}

export function clampElapsed(ms: number, hops: number): number {
  const min = Math.max(500, hops * 120);
  const max = 30 * 60 * 1000;
  if (!Number.isFinite(ms)) return min;
  return Math.min(max, Math.max(min, Math.round(ms)));
}

export function serviceWord(stars: 1 | 2 | 3): string {
  if (stars === 3) return 'Perfect service';
  if (stars === 2) return 'Clean service';
  return 'Home service';
}

export function shareLine(stars: 1 | 2 | 3, length: number, elapsedMs: number): string {
  return `${serviceWord(stars)} — ${formatLength(length)}, ${formatClock(elapsedMs)}. No route.`;
}
