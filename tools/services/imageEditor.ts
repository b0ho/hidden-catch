import sharp, { type Sharp } from 'sharp';
import type { DiffRegion } from '../../shared/types.js';

/** Generation-time region: everything in `DiffRegion` plus curator hints that never
 * reach the client (only x/y/radius/editType are written into a stage's meta.json). */
export interface RegionCandidate extends DiffRegion {
  /** Where to sample "clean" content from, as a fraction of the patch size, relative to
   * the target. Used to clone real background over a removed object, or a real object
   * over a duplicate's target spot — picking this by eye beats guessing algorithmically,
   * since a generic offset can just as easily land on another busy object or a seam. */
  cloneOffset?: { dx: number; dy: number };
}

interface PatchBounds {
  left: number;
  top: number;
  size: number;
}

function computeBounds(region: DiffRegion, imgWidth: number, imgHeight: number): PatchBounds {
  const cx = region.x * imgWidth;
  const cy = region.y * imgHeight;
  const rawSize = Math.round(region.radius * imgWidth * 2);
  const size = Math.max(10, Math.min(rawSize, imgWidth, imgHeight));
  const left = Math.max(0, Math.min(imgWidth - size, Math.round(cx - size / 2)));
  const top = Math.max(0, Math.min(imgHeight - size, Math.round(cy - size / 2)));
  return { left, top, size };
}

/** Soft-edged circular alpha mask — solid through ~60% of the radius, then fades to fully
 * transparent at the rim. A hard-edged circle (the old approach) leaves a crisp, obviously
 * artificial ring around every edit; feathering it is most of what makes a swap look seamless. */
async function featherMask(size: number): Promise<Buffer> {
  const r = size / 2;
  const innerPct = 40;
  const svg = `<svg width="${size}" height="${size}">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
        <stop offset="${innerPct}%" stop-color="#fff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="${r}" cy="${r}" r="${r}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function feather(patch: Sharp, size: number): Promise<Buffer> {
  const mask = await featherMask(size);
  return patch.resize(size, size).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function extract(baseBuffer: Buffer, left: number, top: number, size: number): Promise<Buffer> {
  return sharp(baseBuffer).extract({ left, top, width: size, height: size }).toBuffer();
}

const AUTO_OFFSETS = [
  { dx: 1.35, dy: 0 },
  { dx: -1.35, dy: 0 },
  { dx: 0, dy: 1.35 },
  { dx: 0, dy: -1.35 },
  { dx: 0.95, dy: 0.95 },
  { dx: -0.95, dy: -0.95 },
];

/** Picks a same-size neighboring patch to clone from. A hand-picked `cloneOffset` always
 * wins (the curator looked at the photo and knows what's nearby); otherwise this scores a
 * handful of nearby offsets by pixel variance and takes the flattest in-bounds one, on the
 * theory that low-variance patches (sky, grass, a plain wall) are least likely to visibly
 * clash when pasted over the target. */
async function pickCloneSource(
  baseBuffer: Buffer,
  region: RegionCandidate,
  bounds: PatchBounds,
  imgWidth: number,
  imgHeight: number,
): Promise<{ left: number; top: number }> {
  const { left, top, size } = bounds;

  if (region.cloneOffset) {
    const cLeft = Math.round(left + region.cloneOffset.dx * size);
    const cTop = Math.round(top + region.cloneOffset.dy * size);
    if (cLeft >= 0 && cTop >= 0 && cLeft + size <= imgWidth && cTop + size <= imgHeight) {
      return { left: cLeft, top: cTop };
    }
  }

  let best: { left: number; top: number; score: number } | null = null;
  for (const offset of AUTO_OFFSETS) {
    const cLeft = Math.round(left + offset.dx * size);
    const cTop = Math.round(top + offset.dy * size);
    if (cLeft < 0 || cTop < 0 || cLeft + size > imgWidth || cTop + size > imgHeight) continue;
    const stats = await sharp(baseBuffer)
      .extract({ left: cLeft, top: cTop, width: size, height: size })
      .stats();
    const score = stats.channels.reduce((sum, c) => sum + c.stdev, 0);
    if (!best || score < best.score) best = { left: cLeft, top: cTop, score };
  }
  return best ?? { left, top };
}

async function editedPatchBuffer(
  baseBuffer: Buffer,
  region: RegionCandidate,
  bounds: PatchBounds,
  imgWidth: number,
  imgHeight: number,
): Promise<Buffer> {
  const { left, top, size } = bounds;

  switch (region.editType) {
    case 'colorChange': {
      const raw = await extract(baseBuffer, left, top, size);
      // A gentle recolor reads as "this one thing is a slightly different shade" (weathering,
      // a different paint batch); a big hue swing instead reads as an obvious VFX paint-bucket
      // edit, especially on already-saturated subjects like flowers or dry grass.
      return sharp(raw).modulate({ hue: 12, saturation: 1.08, brightness: 1.03 }).toBuffer();
    }
    case 'objectRemove': {
      // Clone real nearby background over the object instead of blurring it in place — a
      // blur just leaves an obvious smudge where the object used to be; a clone makes it
      // look like the object genuinely isn't there.
      const source = await pickCloneSource(baseBuffer, region, bounds, imgWidth, imgHeight);
      return extract(baseBuffer, source.left, source.top, size);
    }
    case 'resize': {
      const raw = await extract(baseBuffer, left, top, size);
      const source = await pickCloneSource(baseBuffer, region, bounds, imgWidth, imgHeight);
      const fill = await extract(baseBuffer, source.left, source.top, size);
      const shrunk = await sharp(raw).resize(Math.round(size * 0.62)).toBuffer();
      return sharp(fill).composite([{ input: shrunk, gravity: 'center' }]).toBuffer();
    }
    case 'flip': {
      const raw = await extract(baseBuffer, left, top, size);
      return sharp(raw).flop().toBuffer();
    }
    case 'duplicate': {
      // Here the clone direction is inverted: `cloneOffset` should point at a real nearby
      // object to copy, and region.x/y is the (plain) spot it gets pasted onto.
      const source = await pickCloneSource(baseBuffer, region, bounds, imgWidth, imgHeight);
      return extract(baseBuffer, source.left, source.top, size);
    }
  }
}

export async function applyDiff(baseBuffer: Buffer, region: RegionCandidate): Promise<Buffer> {
  const meta = await sharp(baseBuffer).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) {
    throw new Error('이미지 크기를 읽을 수 없습니다.');
  }

  const bounds = computeBounds(region, width, height);
  const rawPatch = await editedPatchBuffer(baseBuffer, region, bounds, width, height);
  const maskedPatch = await feather(sharp(rawPatch), bounds.size);

  return sharp(baseBuffer)
    .composite([{ input: maskedPatch, left: bounds.left, top: bounds.top, blend: 'over' }])
    .toBuffer();
}

export async function applyDiffs(baseBuffer: Buffer, regions: RegionCandidate[]): Promise<Buffer> {
  let current = baseBuffer;
  for (const region of regions) {
    current = await applyDiff(current, region);
  }
  return current;
}
