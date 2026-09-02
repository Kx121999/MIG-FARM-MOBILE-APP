import { Language, Product } from '@/types';

export type CategoryId = 'all' | 'seeds' | 'fertilizers' | 'pest' | 'irrigation' | 'tools' | 'greenhouses';

export type Category = {
  id: CategoryId;
  ar: string;
  en: string;
  icon: string;
  color: string;
  image?: string;
  imageFit?: 'cover' | 'contain';
};

export const categories: Category[] = [
  { id: 'all', ar: 'الكل', en: 'All', icon: 'grid', color: '#0F6B3C' },
  { id: 'seeds', ar: 'البذور', en: 'Seeds', icon: 'seed', color: '#57A23E', image: '/media/products/f1-cucumber-f1-mini-packet-30-seeds-52221101375787.png', imageFit: 'contain' },
  { id: 'fertilizers', ar: 'الأسمدة والمغذيات', en: 'Fertilizers', icon: 'fertilizer', color: '#B68A22', image: '/media/products/baraka-liquid-bio-organic-fertilizer-4-ltr-52110327513387.jpg', imageFit: 'contain' },
  { id: 'pest', ar: 'المبيدات والمكافحة', en: 'Pest control', icon: 'pest', color: '#D7663A', image: '/media/products/sindoxa-cockroach-gel-20gm-53582407205163.jpg', imageFit: 'contain' },
  { id: 'irrigation', ar: 'الري والزراعة المائية', en: 'Irrigation', icon: 'irrigation', color: '#2589A6', image: '/media/products/plastic-round-sprinkler-1-2-1-pcs-52049954242859.png', imageFit: 'contain' },
  { id: 'tools', ar: 'الأدوات والمعدات', en: 'Tools', icon: 'tools', color: '#53695E', image: '/media/products/samurai-saw-13-original-48489672278315.png', imageFit: 'contain' },
  { id: 'greenhouses', ar: 'البيوت المحمية', en: 'Greenhouses', icon: 'greenhouse', color: '#287D54', image: '/media/products/green-net-70-shade-100x2-meter-48381846454571.png', imageFit: 'contain' },
];

const matchers: Record<Exclude<CategoryId, 'all'>, RegExp> = {
  seeds: /seed|seeds|بذور|tomato|cucumber|pepper|eggplant|okra|onion|melon|watermelon|lettuce|radish|spinach|cabbage|corn|bean|squash|pumpkin|طماطم|خيار|فلفل|باذنجان|بامية|بصل|شمام|بطيخ|خس|فجل|سبانخ|ملفوف|ذرة|كوس/i,
  fertilizers: /fertili|nutrient|humic|fulvic|npk|soil|compost|calcium|magnesium|iron|zinc|boron|سماد|أسمدة|مغذي|مغذيات|تربة|كمبوست|حديد|زنك|بورون|كالسيوم/i,
  pest: /pesticide|insecticide|fungicide|herbicide|miticide|cockroach|mosquito|fly bait|trap|rat|pest|مبيد|حشرات|صراصير|بعوض|مصيدة|فطري|حشائش|قوارض/i,
  irrigation: /irrigation|hydroponic|aquaponic|drip|sprinkler|timer|valve|hose|water|pump|ري|زراعة مائية|هيدروبونيك|رشاش|تايمر|مؤقت|خرطوم|صمام|مضخة/i,
  tools: /tool|prun|cutter|scissor|saw|drill|blower|sprayer|meter|equipment|أداة|أدوات|مقص|منشار|دريل|منفاخ|رشاش|متر|معدات/i,
  greenhouses: /greenhouse|green house|shade net|cover|cooling|fan|بيت محمي|بيوت محمية|شبك تظليل|غطاء زراعي|تبريد/i,
};

export function categoryLabel(id: CategoryId, language: Language) {
  const item = categories.find((entry) => entry.id === id) ?? categories[0];
  return item[language];
}

export function productMatchesCategory(product: Product, category: CategoryId) {
  if (category === 'all') return true;
  const haystack = `${product.title} ${product.title_ar || ''} ${product.title_en || ''} ${product.product_type} ${product.product_type_ar || ''} ${product.product_type_en || ''} ${product.tags.join(' ')} ${product.body_html} ${product.body_html_ar || ''} ${product.body_html_en || ''}`;
  return matchers[category].test(haystack);
}
