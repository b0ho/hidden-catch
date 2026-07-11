import sharp, { type Sharp } from 'sharp';
import type { DiffRegion } from '../../shared/types.js';

interface PatchBounds {
  left: number;
  top: number;
  size: number;
}

function computeBounds(region: DiffRegion, imgWidth: number, imgHeight: number): PatchBounds {
  const cx = region.x * imgWidth;
  const cy = region.y * imgHeight;
  const rawSize = Math.round(region.radius * imgWidth * 2);
  const size = Math.max(8, Math.min(rawSize, imgWidth, imgHeight));
  const left = Math.max(0, Math.min(imgWidth - size, Math.round(cx - size / 2)));
  const top = Math.max(0, Math.min(imgHeight - size, Math.round(cy - size / 2)));
  return { left, top, size };
}

async function circleMask(size: number): Promise<Buffer> {
  const svg = `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function maskToCircle(patch: Sharp, size: number): Promise<Buffer> {
  const mask = await circleMask(size);
  return patch
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function extract(baseBuffer: Buffer, left: number, top: number, size: number): Promise<Buffer> {
  return sharp(baseBuffer).extract({ left, top, width: size, height: size }).toBuffer();
}

async function editedPatchBuffer(
  baseBuffer: Buffer,
  region: DiffRegion,
  bounds: PatchBounds,
  imgWidth: number,
  imgHeight: number,
): Promise<Buffer> {
  const { left, top, size } = bounds;

  switch (region.editType) {
    case 'colorChange': {
      const raw = await extract(baseBuffer, left, top, size);
      return sharp(raw).modulate({ hue: 150, saturation: 1.4 }).toBuffer();
    }
    case 'objectRemove': {
      const raw = await extract(baseBuffer, left, top, size);
      return sharp(raw).blur(Math.max(8, size / 5)).toBuffer();
    }
    case 'resize': {
      const raw = await extract(baseBuffer, left, top, size);
      const shrunk = await sharp(raw).resize(Math.round(size * 0.55)).toBuffer();
      const background = await sharp(raw).blur(20).resize(size, size).toBuffer();
      return sharp(background).composite([{ input: shrunk, gravity: 'center' }]).toBuffer();
    }
    case 'flip': {
      const raw = await extract(baseBuffer, left, top, size);
      return sharp(raw).flop().toBuffer();
    }
    case 'duplicate': {
      const srcLeft = Math.max(0, Math.min(imgWidth - size, imgWidth - left - size));
      const srcTop = Math.max(0, Math.min(imgHeight - size, imgHeight - top - size));
      return extract(baseBuffer, srcLeft, srcTop, size);
    }
  }
}

export async function applyDiff(baseBuffer: Buffer, region: DiffRegion): Promise<Buffer> {
  const meta = await sharp(baseBuffer).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) {
    throw new Error('이미지 크기를 읽을 수 없습니다.');
  }

  const bounds = computeBounds(region, width, height);
  const rawPatch = await editedPatchBuffer(baseBuffer, region, bounds, width, height);
  const maskedPatch = await maskToCircle(sharp(rawPatch), bounds.size);

  return sharp(baseBuffer)
    .composite([{ input: maskedPatch, left: bounds.left, top: bounds.top, blend: 'over' }])
    .toBuffer();
}

export async function applyDiffs(baseBuffer: Buffer, regions: DiffRegion[]): Promise<Buffer> {
  let current = baseBuffer;
  for (const region of regions) {
    current = await applyDiff(current, region);
  }
  return current;
}
