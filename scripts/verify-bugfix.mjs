import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Surface Laptop 4 Ryz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const baseUrl = process.env.MIG_FARM_WEB_URL || 'http://127.0.0.1:8090';
const outputRoot = 'C:/Users/Surface Laptop 4 Ryz/Documents/Codex/2026-08-20/files-mentioned-by-the-user-catalog/outputs';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const problems = [];

function watch(page, name) {
  page.on('console', (message) => {
    const ignored = message.text().includes('ERR_NETWORK_ACCESS_DENIED') || message.text().includes('503 (Service Unavailable)');
    if (message.type() === 'error' && !ignored) problems.push(`${name} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${name} page: ${error.message}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    if (!failure.includes('ERR_NETWORK_ACCESS_DENIED') && !failure.includes('ERR_ABORTED')) problems.push(`${name} request: ${request.url()} ${failure}`);
  });
}

async function assertNoHorizontalOverflow(page, name) {
  const overflow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  if (overflow.document > overflow.viewport + 1) problems.push(`${name}: horizontal overflow ${overflow.document}px > ${overflow.viewport}px`);
}

async function verifyMobile(viewport) {
  const name = `mobile-${viewport.width}`;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  watch(page, name);

  await page.goto(`${baseUrl}/catalog`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('المتجر', { exact: true }).first().waitFor({ timeout: 30000 });
  await assertNoHorizontalOverflow(page, `${name}-catalog`);
  const addButtons = page.getByRole('button', { name: 'أضف للسلة' });
  const cardHeights = await addButtons.evaluateAll((buttons) => buttons.slice(0, 8).map((button) => Math.round(button.parentElement?.getBoundingClientRect().height || 0)));
  if (cardHeights.length < 2 || new Set(cardHeights).size !== 1) problems.push(`${name}: product card heights differ: ${cardHeights.join(',')}`);

  await page.goto(`${baseUrl}/product/sindoxa-cockroach-gel-20gm`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('تفاصيل المنتج', { exact: true }).first().waitFor({ timeout: 30000 });
  const gallery = page.locator('img').first();
  const galleryBox = await gallery.boundingBox();
  const title = page.getByText('SINDOXA COCKROACH GEL', { exact: true }).first();
  const titleBox = await title.boundingBox();
  if (!galleryBox || !titleBox || titleBox.y < galleryBox.y + galleryBox.height - 2) problems.push(`${name}: product detail is not single-column`);
  if (galleryBox && galleryBox.height > 350) problems.push(`${name}: gallery remains oversized at ${Math.round(galleryBox.height)}px`);
  const add = page.getByRole('button', { name: 'أضف للسلة' }).last();
  if (await add.isDisabled()) problems.push(`${name}: available product add button is disabled`);
  if (await page.getByText(/Stripe/i).count()) problems.push(`${name}: payment provider name is visible`);
  await assertNoHorizontalOverflow(page, `${name}-product`);
  await page.screenshot({ path: `${outputRoot}/mig-farm-bugfix-${viewport.width}.png`, fullPage: true });
  if (viewport.width === 390) {
    const descriptionHeading = page.getByText('This is a SINDOXA Cockroach Gel, a 20gm syringe applicator used for pest control.', { exact: true }).first();
    if (await descriptionHeading.count()) {
      await descriptionHeading.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${outputRoot}/mig-farm-bugfix-description-390.png` });
    }
  }

  await add.click();
  await page.getByText('اتضاف للسلة', { exact: true }).waitFor({ timeout: 5000 });
  await page.goto(`${baseUrl}/cart`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('ملخص الطلب', { exact: true }).waitFor({ timeout: 30000 });
  if (await page.getByText(/Stripe/i).count()) problems.push(`${name}: payment provider name is visible in cart`);
  await assertNoHorizontalOverflow(page, `${name}-cart`);
  if (viewport.width === 390) {
    await page.getByText('إكمال الطلب والدفع', { exact: true }).click();
    await page.waitForURL(/\/checkout$/, { timeout: 10000 });
    await page.getByText('بيانات الاستلام', { exact: true }).waitFor({ timeout: 10000 });
    const inputs = page.locator('input');
    await inputs.nth(0).fill('Ahmed Test');
    await inputs.nth(1).fill('ahmed@example.com');
    await inputs.nth(2).fill('+971500000000');
    await inputs.nth(3).fill('Dubai');
    await page.locator('textarea').nth(0).fill('MIG Farm test delivery address');
    await page.getByText('المتابعة لبيانات البطاقة', { exact: true }).click();
    await page.getByText('خدمة الدفع غير متاحة حاليًا. حاول مرة أخرى لاحقًا.', { exact: true }).waitFor({ timeout: 10000 });
    if (await page.getByText(/Stripe/i).count()) problems.push(`${name}: payment provider name is visible in checkout`);

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByText('أقسام المتجر', { exact: true }).waitFor({ timeout: 30000 });
    for (const label of ['الرئيسية', 'الأقسام', 'البحث', 'السلة', 'حسابي']) await page.getByText(label, { exact: true }).waitFor({ timeout: 10000 });
    await assertNoHorizontalOverflow(page, `${name}-home`);
  }

  await page.goto(`${baseUrl}/search`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('البحث', { exact: true }).first().waitFor({ timeout: 30000 });
  await assertNoHorizontalOverflow(page, `${name}-search`);
  await context.close();
}

for (const viewport of [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) await verifyMobile(viewport);

const englishContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const englishPage = await englishContext.newPage();
watch(englishPage, 'english');
await englishPage.goto(`${baseUrl}/account`, { waitUntil: 'networkidle', timeout: 120000 });
await englishPage.getByText('English', { exact: true }).click();
await englishPage.goto(`${baseUrl}/product/sindoxa-cockroach-gel-20gm`, { waitUntil: 'networkidle', timeout: 120000 });
await englishPage.getByText('Product details', { exact: true }).first().waitFor({ timeout: 30000 });
if (await englishPage.evaluate(() => document.documentElement.dir) !== 'ltr') problems.push('english: document direction is not LTR');
if (!await englishPage.getByText('Secure payment', { exact: true }).count()) problems.push('english: localized trust label missing');
await assertNoHorizontalOverflow(englishPage, 'english-product');
await englishContext.close();

const tabletContext = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1 });
const tabletPage = await tabletContext.newPage();
watch(tabletPage, 'tablet');
await tabletPage.goto(`${baseUrl}/product/sindoxa-cockroach-gel-20gm`, { waitUntil: 'networkidle', timeout: 120000 });
await tabletPage.getByText('تفاصيل المنتج', { exact: true }).first().waitFor({ timeout: 30000 });
await assertNoHorizontalOverflow(tabletPage, 'tablet-product');
await tabletContext.close();

console.log('BUGFIX QA: catalog cards, product detail, gallery, add state, cart, search, RTL/LTR and responsive widths checked');
console.log(problems.length ? `PROBLEMS\n${problems.join('\n')}` : 'PROBLEMS none');
await browser.close();
if (problems.length) process.exitCode = 1;
