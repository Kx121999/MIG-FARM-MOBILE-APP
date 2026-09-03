import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const sharp = require(process.env.MIG_SHARP_PATH || 'sharp');
const source = await readFile('src/utils/appEntry.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { ONBOARDING_KEY, hasCompletedOnboarding, completeOnboarding } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const baseline = {
  "eas.json": "BCC06A141B717EB1BD13E51E8598B214AC0A5855C2A9DA75AE73AA9F0AC0C254",
  "src/services/ai.ts": "FC1759322E47125A39328944322778A6DB83FA5BDA84B5EBCB7DE9079699A8E2",
  "src/services/catalog.ts": "8EA136FE17A9289763BC7352D13FFD868F06A2EB47904A62285395C21DE73395"
};
const app = JSON.parse(await readFile('app.json', 'utf8')).expo;

test('first launch, completion, returning launch and unrelated storage are preserved', async () => {
  const data = new Map([['mig_farm_cart_v1', 'untouched']]);
  const storage = { getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
  assert.equal(await hasCompletedOnboarding(storage), false);
  await completeOnboarding(storage);
  assert.equal(data.get(ONBOARDING_KEY), 'complete');
  assert.equal(await hasCompletedOnboarding(storage), true);
  assert.equal(data.get('mig_farm_cart_v1'), 'untouched');
});
test('storage errors never block guest access', async () => {
  const storage = { getItem: async () => { throw new Error('unavailable'); }, setItem: async () => { throw new Error('quota'); } };
  assert.equal(await hasCompletedOnboarding(storage), true);
  await assert.doesNotReject(completeOnboarding(storage));
});
test('unresponsive storage has a bounded wait', async () => {
  assert.equal(await hasCompletedOnboarding({ getItem: () => new Promise(() => {}), setItem: async () => {} }), true);
});
test('catalog, AI service and EAS configuration remain byte-for-byte unchanged', async () => {
  for (const [file, expected] of Object.entries(baseline)) {
    const hash = createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase();
    assert.equal(hash, expected, file);
  }
});
test('app identity, API, Stripe and simulator configuration remain intact', async () => {
  assert.equal(app.name, 'MIG FARM | ميغ فارم');
  assert.equal(app.android.package, 'com.migfarm.app');
  assert.equal(app.ios.bundleIdentifier, 'com.migfarm.app');
  assert.equal(app.extra.apiUrl, 'https://mig-farm-api.onrender.com');
  assert.equal(app.extra.aiApiUrl, 'https://mig-farm-ai-backend.vercel.app/api/chat');
  assert.deepEqual(app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === '@stripe/stripe-react-native'),
    ['@stripe/stripe-react-native', { merchantIdentifier: 'merchant.com.migfarm.app', enableGooglePay: true }]);
  const eas = JSON.parse(await readFile('eas.json', 'utf8'));
  assert.deepEqual(Object.keys(eas.build), ['preview', 'ios-simulator', 'production']);
});
test('iOS and Android icons are square opaque compositions of the official logo', async () => {
  for (const [file, width] of [[app.icon,780], [app.android.adaptiveIcon.foregroundImage,540]]) {
    const meta = await sharp(file).metadata();
    assert.equal(meta.width, 1024); assert.equal(meta.height, 1024); assert.equal(meta.hasAlpha, false);
    const logo = await sharp('assets/mig-farm-logo.png').resize({ width, fit: 'inside' }).png().toBuffer();
    const expected = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#FFFFFF' } }).composite([{ input: logo, gravity: 'centre' }]).removeAlpha().raw().toBuffer();
    const actual = await sharp(file).raw().toBuffer();
    assert.deepEqual(actual, expected);
  }
});
test('adaptive artwork fits inside the launcher circular safe zone', async () => {
  const { data, info } = await sharp(app.android.adaptiveIcon.foregroundImage).raw().toBuffer({ resolveWithObject: true });
  let outside = 0, colored = 0;
  for (let y=0; y<info.height; y++) for(let x=0; x<info.width; x++) {
    const offset = (y*info.width+x)*info.channels;
    if (data[offset]<245 || data[offset+1]<245 || data[offset+2]<245) {
      colored++;
      if(Math.hypot(x-512,y-512)>1024*66/108/2) outside++;
    }
  }
  assert.ok(colored>10000); assert.equal(outside, 0);
});
test('splash uses the official logo without stretching and hero is optimized', async () => {
  const splash = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  assert.equal(splash.resizeMode, 'contain'); assert.equal(splash.imageWidth, 200);
  assert.equal(splash.backgroundColor, '#FFFFFF');
  const original = await sharp('assets/mig-farm-logo.png').raw().toBuffer();
  assert.deepEqual(await sharp(splash.image).raw().toBuffer(), original);
  const optimized = await readFile('assets/home-farm.webp');
  assert.ok(optimized.length < (await readFile('assets/home-hero-farm-2027.png')).length / 3);
});
