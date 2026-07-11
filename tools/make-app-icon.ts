import { writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </radialGradient>
    <radialGradient id="body" cx="38%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="35%" stop-color="#ff6b6b" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="280" r="150" fill="url(#body)"/>
  <circle cx="205" cy="250" r="34" fill="#ffffff"/>
  <circle cx="307" cy="250" r="34" fill="#ffffff"/>
  <circle cx="213" cy="256" r="16" fill="#2b2b2b"/>
  <circle cx="315" cy="256" r="16" fill="#2b2b2b"/>
  <path d="M 210 320 Q 256 355 302 320" stroke="#2b2b2b" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>`;

async function main() {
  const outDir = path.resolve(process.cwd(), '..', 'client', 'public', 'icons');
  const buffer192 = await sharp(Buffer.from(svg)).resize(192, 192).png().toBuffer();
  const buffer512 = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  await writeFile(path.join(outDir, 'icon-192.png'), buffer192);
  await writeFile(path.join(outDir, 'icon-512.png'), buffer512);
  console.log('앱 아이콘 생성 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
