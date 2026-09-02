import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(projectRoot, 'server', 'data');
const mediaDir = join(projectRoot, 'server', 'public', 'media', 'products');
const sourceUrl = process.env.MIGRATION_SOURCE_URL || 'https://www.migfarm.com/products.json?limit=250';
const concurrency = 8;

await Promise.all([mkdir(dataDir, { recursive: true }), mkdir(mediaDir, { recursive: true })]);

const sourceResponse = await fetchWithRetry(sourceUrl);
const source = await sourceResponse.json();
const products = Array.isArray(source.products) ? source.products : [];
if (!products.length) throw new Error('The source catalog returned no products.');

const imageJobs = products.flatMap((product) => (product.images || []).map((image, index) => ({ product, image, index })));
const localImageBySource = new Map();
let completed = 0;

await runPool(imageJobs, concurrency, async ({ product, image, index }) => {
  const extension = imageExtension(image.src);
  const filename = `${safeName(product.handle)}-${image.id || index + 1}${extension}`;
  const response = await fetchWithRetry(image.src);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Empty image: ${image.src}`);
  await writeFile(join(mediaDir, filename), bytes);
  localImageBySource.set(image.src, `/media/products/${filename}`);
  completed += 1;
  if (completed % 25 === 0 || completed === imageJobs.length) {
    process.stdout.write(`Migrated ${completed}/${imageJobs.length} images\n`);
  }
});

const migratedProducts = products.map((product) => ({
  ...product,
  images: (product.images || []).map((image) => ({
    ...image,
    src: localImageBySource.get(image.src),
  })),
  variants: (product.variants || []).map((variant) => ({
    ...variant,
    featured_image: variant.featured_image
      ? { ...variant.featured_image, src: localImageBySource.get(variant.featured_image.src) || null }
      : null,
  })),
}));

const catalog = {
  version: 1,
  migratedAt: new Date().toISOString(),
  productCount: migratedProducts.length,
  imageCount: imageJobs.length,
  products: migratedProducts,
};

await writeFile(join(dataDir, 'products.json'), `${JSON.stringify(catalog)}\n`, 'utf8');
process.stdout.write(`Catalog ready: ${migratedProducts.length} products and ${imageJobs.length} local images.\n`);

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: '*/*' }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function runPool(items, size, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function safeName(value) {
  return String(value || 'product').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function imageExtension(value) {
  const extension = extname(new URL(value).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension) ? extension : '.jpg';
}
