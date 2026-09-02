import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Surface Laptop 4 Ryz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const appUrl = process.env.MIG_FARM_WEB_URL || 'http://127.0.0.1:8093';
const apiUrl = 'https://mig-farm-api.onrender.com';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const requests = [];
const responses = [];
const problems = [];

page.on('request', (request) => requests.push(request.url()));
page.on('response', (response) => responses.push({ url: response.url(), status: response.status() }));
page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('503 (Service Unavailable)')) {
    problems.push(`console error: ${message.text()}`);
  }
});

const health = await context.request.get(`${apiUrl}/health`);
if (health.status() !== 200 || !(await health.json()).ok) problems.push(`/health returned ${health.status()}`);

await page.goto(`${appUrl}/catalog`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.getByText('المتجر', { exact: true }).first().waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'أضف للسلة' }).first().waitFor({ timeout: 60000 });
await page.waitForTimeout(2000);

if (!requests.some((url) => url.startsWith(`${apiUrl}/api/products`))) {
  problems.push('catalog did not request the production /api/products endpoint');
}
if (!responses.some(({ url, status }) => url.startsWith(`${apiUrl}/media/products/`) && status === 200)) {
  problems.push('no product media returned 200 from the production backend');
}

await page.goto(`${appUrl}/product/sindoxa-cockroach-gel-20gm`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.getByText('تفاصيل المنتج', { exact: true }).first().waitFor({ timeout: 60000 });
const addButton = page.getByRole('button', { name: 'أضف للسلة' }).last();
await addButton.waitFor({ timeout: 30000 });
await addButton.click();
await page.getByText('اتضاف للسلة', { exact: true }).waitFor({ timeout: 10000 });
await page.waitForTimeout(1500);
await page.goto(`${appUrl}/cart`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.getByText('ملخص الطلب', { exact: true }).waitFor({ timeout: 30000 });

let checkoutCaptured = false;
await page.route(`${apiUrl}/api/checkout/session`, async (route) => {
  checkoutCaptured = true;
  await route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'payment_provider_not_configured' }),
  });
});

await page.getByText('إكمال الطلب والدفع', { exact: true }).click();
await page.waitForURL(/\/checkout$/, { timeout: 10000 });
await page.getByText('بيانات الاستلام', { exact: true }).waitFor({ timeout: 10000 });
const inputs = page.locator('input');
await inputs.nth(0).fill('MIG Farm QA');
await inputs.nth(1).fill('qa@migfarm.example');
await inputs.nth(2).fill('+971500000000');
await inputs.nth(3).fill('Dubai');
await page.locator('textarea').nth(0).fill('Production API connection test');
await page.getByText('المتابعة لبيانات البطاقة', { exact: true }).click();
await page.getByText('خدمة الدفع غير متاحة حاليًا. حاول مرة أخرى لاحقًا.', { exact: true }).waitFor({ timeout: 10000 });

if (!checkoutCaptured) problems.push('checkout did not target the production backend');
const forbidden = requests.filter((url) => /https?:\/\/(127\.0\.0\.1|localhost):8787/i.test(url));
if (forbidden.length) problems.push(`local backend requests detected: ${forbidden.join(', ')}`);

console.log(`HEALTH ${health.status()}`);
console.log(`PRODUCTS ${requests.find((url) => url.startsWith(`${apiUrl}/api/products`)) || 'missing'}`);
console.log(`MEDIA_200 ${responses.filter(({ url, status }) => url.startsWith(`${apiUrl}/media/products/`) && status === 200).length}`);
console.log(`CHECKOUT_TARGET ${checkoutCaptured ? `${apiUrl}/api/checkout/session` : 'missing'}`);
console.log(`LOCAL_BACKEND_REQUESTS ${forbidden.length}`);
console.log(problems.length ? `PROBLEMS\n${problems.join('\n')}` : 'PROBLEMS none');

await browser.close();
if (problems.length) process.exitCode = 1;
