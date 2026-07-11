import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { applyDiffs } from './services/imageEditor.js';
import type { DiffRegion, StageMeta } from '../shared/types.js';

const WIDTH = 900;
const HEIGHT = 600;

interface SceneDef {
  id: string;
  title: string;
  svg: string;
  diffs: DiffRegion[];
}

const scenes: SceneDef[] = [
  {
    id: 'stage-01',
    title: '해변',
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
        <rect width="${WIDTH}" height="360" fill="#8ecae6"/>
        <rect y="360" width="${WIDTH}" height="240" fill="#f1c27d"/>
        <circle cx="750" cy="90" r="55" fill="#ffd166"/>
        <ellipse cx="200" cy="120" rx="70" ry="28" fill="#ffffff"/>
        <ellipse cx="320" cy="150" rx="50" ry="20" fill="#ffffff"/>
        <polygon points="450,340 500,340 480,290" fill="#ef476f"/>
        <rect x="440" y="340" width="70" height="10" fill="#264653"/>
        <circle cx="150" cy="470" r="26" fill="#06d6a0"/>
        <circle cx="700" cy="500" r="18" fill="#118ab2"/>
        <rect x="600" y="430" width="40" height="60" fill="#8d5524"/>
      </svg>`,
    diffs: [
      { x: 0.833, y: 0.15, radius: 0.07, editType: 'colorChange' },
      { x: 0.222, y: 0.2, radius: 0.06, editType: 'objectRemove' },
      { x: 0.522, y: 0.55, radius: 0.05, editType: 'flip' },
      { x: 0.167, y: 0.783, radius: 0.05, editType: 'resize' },
      { x: 0.689, y: 0.75, radius: 0.05, editType: 'duplicate' },
    ],
  },
  {
    id: 'stage-02',
    title: '숲',
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
        <rect width="${WIDTH}" height="${HEIGHT}" fill="#b7e4c7"/>
        <circle cx="700" cy="100" r="50" fill="#ffd166"/>
        <rect x="150" y="380" width="24" height="120" fill="#7f5539"/>
        <circle cx="162" cy="340" r="70" fill="#2d6a4f"/>
        <rect x="330" y="420" width="20" height="100" fill="#7f5539"/>
        <circle cx="340" cy="380" r="55" fill="#40916c"/>
        <rect x="520" y="400" width="22" height="110" fill="#7f5539"/>
        <circle cx="531" cy="360" r="62" fill="#2d6a4f"/>
        <ellipse cx="250" cy="150" rx="60" ry="24" fill="#ffffff"/>
        <circle cx="470" cy="500" r="20" fill="#d62828"/>
      </svg>`,
    diffs: [
      { x: 0.778, y: 0.167, radius: 0.06, editType: 'colorChange' },
      { x: 0.18, y: 0.567, radius: 0.06, editType: 'resize' },
      { x: 0.378, y: 0.633, radius: 0.05, editType: 'flip' },
      { x: 0.278, y: 0.25, radius: 0.06, editType: 'objectRemove' },
      { x: 0.522, y: 0.833, radius: 0.045, editType: 'duplicate' },
    ],
  },
  {
    id: 'stage-03',
    title: '도시',
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
        <rect width="${WIDTH}" height="${HEIGHT}" fill="#cdd7e1"/>
        <rect x="80" y="220" width="120" height="300" fill="#495057"/>
        <rect x="240" y="150" width="100" height="370" fill="#343a40"/>
        <rect x="380" y="260" width="130" height="260" fill="#495057"/>
        <rect x="560" y="180" width="90" height="340" fill="#343a40"/>
        <rect x="690" y="300" width="110" height="220" fill="#495057"/>
        <circle cx="120" cy="270" r="10" fill="#ffd60a"/>
        <circle cx="160" cy="270" r="10" fill="#ffd60a"/>
        <circle cx="270" cy="200" r="10" fill="#ffd60a"/>
        <circle cx="610" cy="230" r="10" fill="#ffd60a"/>
        <ellipse cx="700" cy="100" rx="80" ry="26" fill="#ffffff"/>
      </svg>`,
    diffs: [
      { x: 0.156, y: 0.45, radius: 0.055, editType: 'colorChange' },
      { x: 0.322, y: 0.583, radius: 0.06, editType: 'objectRemove' },
      { x: 0.678, y: 0.55, radius: 0.06, editType: 'flip' },
      { x: 0.778, y: 0.167, radius: 0.065, editType: 'resize' },
      { x: 0.133, y: 0.45, radius: 0.03, editType: 'duplicate' },
    ],
  },
];

async function seedScene(scene: SceneDef) {
  const originalBuffer = await sharp(Buffer.from(scene.svg)).jpeg({ quality: 92 }).toBuffer();
  const modifiedBuffer = await applyDiffs(originalBuffer, scene.diffs);

  const outDir = path.resolve(process.cwd(), '..', 'client', 'public', 'stages', scene.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'original.jpg'), originalBuffer);
  await writeFile(path.join(outDir, 'modified.jpg'), await sharp(modifiedBuffer).jpeg({ quality: 92 }).toBuffer());

  const meta: StageMeta = { id: scene.id, diffs: scene.diffs };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`스테이지 "${scene.id}" (${scene.title}) 생성 완료: ${outDir}`);
}

async function main() {
  for (const scene of scenes) {
    await seedScene(scene);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
