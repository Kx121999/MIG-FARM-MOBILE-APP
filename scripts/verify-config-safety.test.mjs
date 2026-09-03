import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const app = JSON.parse(await readFile(new URL('app.json', root), 'utf8')).expo;
const eas = JSON.parse(await readFile(new URL('eas.json', root), 'utf8'));
const pluginName = (plugin) => Array.isArray(plugin) ? plugin[0] : plugin;
const optionsFor = (name) => app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name)?.[1];

test('production API URLs, router config and EAS linkage are preserved', () => {
  assert.equal(app.extra.apiUrl, 'https://mig-farm-api.onrender.com');
  assert.equal(app.extra.aiApiUrl, 'https://mig-farm-ai-backend.vercel.app/api/chat');
  assert.deepEqual(app.extra.router, {});
  assert.equal(app.extra.eas.projectId, 'c8afa207-58bc-4e62-9341-0b4d2e1b8661');
});

test('native identifiers and encryption declaration are preserved', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.migfarm.app');
  assert.equal(app.android.package, 'com.migfarm.app');
  assert.equal(app.ios.infoPlist.ITSAppUsesNonExemptEncryption, false);
  assert.equal(app.scheme, 'migfarm');
});

test('all current Expo plugins and Stripe settings remain enabled', () => {
  const names = app.plugins.map(pluginName);
  for (const name of ['expo-router', 'expo-splash-screen', 'expo-image-picker', 'expo-secure-store', '@stripe/stripe-react-native']) {
    assert.ok(names.includes(name), name);
    assert.equal(names.filter((value) => value === name).length, 1, name);
  }
  assert.equal(optionsFor('@stripe/stripe-react-native').merchantIdentifier, 'merchant.com.migfarm.app');
  assert.equal(optionsFor('@stripe/stripe-react-native').enableGooglePay, true);
  assert.equal(optionsFor('expo-secure-store').configureAndroidBackup, true);
  assert.equal(optionsFor('expo-secure-store').faceIDPermission, false);
  assert.equal(optionsFor('expo-image-picker').microphonePermission, false);
});

test('new icon, adaptive icon and splash assets are retained', async () => {
  assert.equal(app.icon, './assets/icon-mig-farm.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon-mig-farm.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#FFFFFF');
  const splash = optionsFor('expo-splash-screen');
  assert.equal(splash.image, './assets/splash-mig-farm.png');
  assert.equal(splash.resizeMode, 'contain');
  assert.equal(splash.imageWidth, 200);
  assert.equal(splash.backgroundColor, '#FFFFFF');
  for (const path of [app.icon, app.android.adaptiveIcon.foregroundImage, splash.image]) {
    await access(new URL(path, root));
  }
});

test('EAS Android preview, iOS simulator, production and submit remain intact', () => {
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build['ios-simulator'].ios.simulator, true);
  assert.equal(eas.build.production.autoIncrement, true);
  assert.deepEqual(eas.submit.production, {});
  for (const name of ['preview', 'ios-simulator', 'production']) {
    assert.equal(eas.build[name].env.EXPO_PUBLIC_API_URL, app.extra.apiUrl);
  }
});
