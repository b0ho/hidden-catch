import type { DiffRegion } from '@shared/types';

/**
 * All coordinates are fractions (0..1) of the panel. `region.radius` is a
 * fraction of image width (see shared/types.ts), so the y-delta is rescaled
 * by the image aspect ratio (width/height) before comparing distances —
 * otherwise a non-square image would make the hit circle an ellipse.
 */
export function hitTest(
  clickXFrac: number,
  clickYFrac: number,
  region: DiffRegion,
  aspectRatio: number,
): boolean {
  const dx = clickXFrac - region.x;
  const dy = (clickYFrac - region.y) / aspectRatio;
  return Math.sqrt(dx * dx + dy * dy) <= region.radius;
}
