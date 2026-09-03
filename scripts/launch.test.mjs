import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const source = await readFile('src/utils/launchLanguage.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { resolveLaunchLanguage } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('fresh install uses Arabic device locale or English fallback', () => {
  for (const locale of ['ar', 'ar-AE', 'AR-sa']) assert.equal(resolveLaunchLanguage(null, locale), 'ar');
  for (const locale of ['en-AE', 'fr-FR', undefined, '']) assert.equal(resolveLaunchLanguage(null, locale), 'en');
});
test('saved language overrides device locale after both language switches', () => {
  assert.equal(resolveLaunchLanguage('en', 'ar-AE'), 'en');
  assert.equal(resolveLaunchLanguage('ar', 'en-US'), 'ar');
  assert.equal(resolveLaunchLanguage('invalid', 'ar-AE'), 'ar');
});
test('both final user artworks remain byte-identical with their original aspect ratio', async () => {
  const hashes = { ar: 'AAE3CA389168BFD0AEF4483A2C81F5D44C40A8F1847BDC0E2B8809F401A8760B', en: 'A0674F51ACC66E1CBF4AA2C8EE534252D048D1F9211E8CE924334CCECED9041F' };
  for (const language of ['ar', 'en']) {
    const file = await readFile('assets/launch/mig-farm-launch-' + language + '.png');
    assert.equal(createHash('sha256').update(file).digest('hex').toUpperCase(), hashes[language]);
    const width = file.readUInt32BE(16), height = file.readUInt32BE(20);
    assert.equal(width, 941); assert.equal(height, 1672);
    for (const [w,h,top,bottom] of [[320,568,24,24],[360,800,24,24],[412,915,24,24],[390,844,47,34],[393,852,59,34],[430,932,59,34]]) {
      const scale = Math.min(w/width, (h-top-bottom)/height);
      assert.ok(width*scale <= w+.001); assert.ok(height*scale <= h-top-bottom+.001);
    }
  }
});
test('startup is bundled, non-mirrored, contain-scaled, safe-area-aware and independent of APIs', async () => {
  const component = await readFile('src/components/LocalizedLaunchScreen.tsx', 'utf8');
  assert.match(component, /Asset.loadAsync\(\[launchImages.ar, launchImages.en\]\)/);
  assert.match(component, /resizeMode="contain"/);
  assert.match(component, /useSafeAreaInsets/);
  assert.doesNotMatch(component, /scaleX|fetch\(|apiRequest|services\/catalog/);
  const entry = await readFile('src/components/AppEntry.tsx', 'utf8');
  assert.match(entry, /!languageReady \|\| !assetsReady/);
  assert.doesNotMatch(entry, /authService|apiRequest|fetch\(/);
});
