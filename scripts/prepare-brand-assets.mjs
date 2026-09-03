import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.MIG_SHARP_PATH || 'sharp');
const assets = path.resolve('assets');
await mkdir(assets, { recursive: true });
const logo = path.join(assets, 'mig-farm-logo.png');

// Compositing preserves the official bitmap, proportions and colors.
for (const [name, width] of [['icon-mig-farm.png', 780], ['adaptive-icon-mig-farm.png', 540]]) {
  const foreground = await sharp(logo).resize({ width, fit: 'inside' }).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: foreground, gravity: 'centre' }]).removeAlpha().png().toFile(path.join(assets, name));
}
await sharp(logo).png().toFile(path.join(assets, 'splash-mig-farm.png'));
await sharp(path.join(assets, 'home-hero-farm-2027.png')).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(assets, 'home-farm.webp'));
for (const [name, ext] of [['seeds','png'], ['fertilizers','jpg'], ['pest','jpg'], ['irrigation','png'], ['tools','png'], ['greenhouses','png']]) {
  await sharp(path.join(assets, 'category-' + name + '.' + ext)).resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(path.join(assets, 'category-' + name + '.webp'));
}
console.log('Official logo assets and optimized existing imagery prepared.');
