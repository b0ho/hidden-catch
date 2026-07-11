import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { planDiffs } from './services/diffPlanner.js';
import { applyDiffs } from './services/imageEditor.js';
import type { StageMeta } from '../shared/types.js';

interface Args {
  image: string;
  id: string;
  diffsFile?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--image') args.image = argv[i + 1];
    if (argv[i] === '--id') args.id = argv[i + 1];
    if (argv[i] === '--diffs-file') args.diffsFile = argv[i + 1];
  }
  if (!args.image || !args.id) {
    throw new Error('사용법: generate-stage --image <path> --id <stage-id> [--diffs-file <path>]');
  }
  return args as Args;
}

async function main() {
  const { image, id, diffsFile } = parseArgs(process.argv.slice(2));

  const sourceBuffer = await readFile(image);
  const mediaType = image.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const diffs = diffsFile
    ? (JSON.parse(await readFile(diffsFile, 'utf-8')) as StageMeta['diffs'])
    : await planDiffs(sourceBuffer, mediaType);

  const normalizedOriginal = await sharp(sourceBuffer).jpeg({ quality: 90 }).toBuffer();
  const modifiedBuffer = await applyDiffs(normalizedOriginal, diffs);

  const outDir = path.resolve(process.cwd(), '..', 'client', 'public', 'stages', id);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'original.jpg'), normalizedOriginal);
  await writeFile(path.join(outDir, 'modified.jpg'), await sharp(modifiedBuffer).jpeg({ quality: 90 }).toBuffer());

  const meta: StageMeta = { id, diffs };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`스테이지 "${id}" 생성 완료: ${outDir}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
