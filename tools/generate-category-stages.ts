import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { applyDiffs, type RegionCandidate } from './services/imageEditor.js';
import type { DiffRegion, StageMeta } from '../shared/types.js';

const STAGES_PER_CATEGORY = 30;
const DIFFS_PER_STAGE = 5;

interface CategoryDef {
  id: string;
  /** Path to the source photo, relative to the repo root. */
  sourceImage: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'hanok', sourceImage: 'asset/370FD67F-4744-411D-9963-DC27F61FD0FE_4_5005_c.jpeg' },
  { id: 'temple', sourceImage: 'asset/49C5A5EF-5C2A-4796-920A-047274726ED3_4_5005_c.jpeg' },
  { id: 'wildflowers', sourceImage: 'asset/011E64E2-761C-40E5-9254-AD215FEDA51B_4_5005_c.jpeg' },
  { id: 'diving-helmet', sourceImage: 'asset/E386796D-8C46-4090-85AD-E3474CD07238_4_5005_c.jpeg' },
  { id: 'cliff-cave', sourceImage: 'asset/FE234C46-C9B3-48EA-ADA2-E3A1F1BD871C_4_5005_c.jpeg' },
];

/** Small random nudge so stages that reuse the same pool region don't land on the exact
 * same pixels every time — keeps repeated combinations across 30 stages feeling distinct. */
function jitter(region: RegionCandidate): RegionCandidate {
  const jitterFrac = region.radius * 0.3;
  return {
    ...region,
    x: region.x + (Math.random() * 2 - 1) * jitterFrac,
    y: region.y + (Math.random() * 2 - 1) * jitterFrac,
  };
}

function toRuntimeDiff(region: RegionCandidate): DiffRegion {
  return { x: region.x, y: region.y, radius: region.radius, editType: region.editType };
}

/** Picks `count` unique, order-independent 5-element subsets of `pool` (indices). */
function pickUniqueCombos(poolSize: number, comboSize: number, count: number): number[][] {
  const seen = new Set<string>();
  const combos: number[][] = [];
  let guard = 0;
  while (combos.length < count && guard < count * 200) {
    guard += 1;
    const indices = Array.from({ length: poolSize }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const combo = indices.slice(0, comboSize).sort((a, b) => a - b);
    const key = combo.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push(combo);
  }
  if (combos.length < count) {
    throw new Error(`후보 풀이 너무 작아 고유한 조합 ${count}개를 만들 수 없습니다 (풀 크기: ${poolSize}).`);
  }
  return combos;
}

async function generateCategory(category: CategoryDef, repoRoot: string) {
  const poolPath = path.join(repoRoot, 'tools', 'region-pools', `${category.id}.json`);
  const pool = JSON.parse(await readFile(poolPath, 'utf-8')) as RegionCandidate[];
  if (pool.length < DIFFS_PER_STAGE) {
    throw new Error(`${category.id}: 후보 풀이 ${DIFFS_PER_STAGE}개 미만입니다.`);
  }

  const sourceBuffer = await readFile(path.join(repoRoot, category.sourceImage));
  const normalizedOriginal = await sharp(sourceBuffer).jpeg({ quality: 90 }).toBuffer();

  const outDir = path.join(repoRoot, 'client', 'public', 'stages', category.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'original.jpg'), normalizedOriginal);

  const combos = pickUniqueCombos(pool.length, DIFFS_PER_STAGE, STAGES_PER_CATEGORY);

  for (let i = 0; i < combos.length; i += 1) {
    const order = i + 1;
    const stageId = `${category.id}-${String(order).padStart(2, '0')}`;
    const regions = combos[i].map((idx) => jitter(pool[idx]));

    const modifiedBuffer = await applyDiffs(normalizedOriginal, regions);
    const stageDir = path.join(outDir, String(order).padStart(2, '0'));
    await mkdir(stageDir, { recursive: true });
    await writeFile(path.join(stageDir, 'modified.jpg'), await sharp(modifiedBuffer).jpeg({ quality: 90 }).toBuffer());

    const meta: StageMeta = { id: stageId, diffs: regions.map(toRuntimeDiff) };
    await writeFile(path.join(stageDir, 'meta.json'), JSON.stringify(meta, null, 2));
  }

  console.log(`카테고리 "${category.id}": ${combos.length}개 스테이지 생성 완료 (${outDir})`);
}

async function main() {
  const only = process.argv[2];
  const repoRoot = path.resolve(process.cwd(), '..');
  const targets = only ? CATEGORIES.filter((c) => c.id === only) : CATEGORIES;
  if (targets.length === 0) {
    throw new Error(`알 수 없는 카테고리: ${only}`);
  }
  for (const category of targets) {
    await generateCategory(category, repoRoot);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
