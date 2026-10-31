import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

// Quét public/corpus/<người-thu>/<từ>.(wav|mp3|ogg|webm|m4a|flac) và sinh manifest.json
const root = join(process.cwd(), 'public', 'corpus');
if (!existsSync(root)) mkdirSync(root, { recursive: true });

const exts = new Set(['.wav', '.mp3', '.ogg', '.webm', '.m4a', '.flac']);
const words = [];

for (const speaker of readdirSync(root)) {
  const dir = join(root, speaker);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir)) {
    if (!exts.has(extname(f).toLowerCase())) continue;
    const word = basename(f, extname(f)).replace(/[_\-.]+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').trim();
    words.push({ word, speaker, file: `${speaker}/${f}` });
  }
}

writeFileSync(join(root, 'manifest.json'), JSON.stringify({ words }, null, 2));
console.log(`Đã ghi ${words.length} mục vào public/corpus/manifest.json`);

