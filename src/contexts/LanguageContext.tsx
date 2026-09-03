import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Language } from '@/types';
import { getLocales } from 'expo-localization';
import { resolveLaunchLanguage } from '@/utils/launchLanguage';

const STORAGE_KEY = 'mig_farm_language_v1';

const copy = {
  ar: {
    home: 'الرئيسية',
    store: 'المتجر',
    departments: 'الأقسام',
    assistant: 'المساعد',
    cart: 'السلة',
    account: 'حسابي',
    welcome: 'كل اللي تحتاجه للزراعة',
    heroBody: 'بذور ومغذيات ومعدات وحلول زراعية موثوقة لكل الإمارات',
    shopNow: 'تسوق الآن',
    askEngineer: 'اسأل المهندس',
    categories: 'أقسام المتجر',
    featured: 'وصل حديثًا',
    viewAll: 'عرض الكل',
    freeShipping: 'شحن سريع لكل الإمارات',
    aiTitle: 'مش متأكد تختار إيه؟',
    aiBody: 'صوّر المشكلة أو اكتب سؤالك، والمساعد الزراعي يساعدك تختار الحل المناسب.',
    search: 'ابحث عن منتج أو بذور أو سماد...',
    searchTab: 'البحث',
    searchSuggestions: 'اقتراحات البحث',
    recentSearches: 'عمليات البحث الأخيرة',
    clearRecent: 'مسح السجل',
    featuredProducts: 'منتجات مقترحة',
    brands: 'الماركة',
    productType: 'نوع المنتج',
    priceRange: 'نطاق السعر',
    chooseCategory: 'القسم',
    allBrands: 'كل الماركات',
    allTypes: 'كل الأنواع',
    minPrice: 'من',
    maxPrice: 'إلى',
    popularSort: 'الأكثر طلباً',
    newestSort: 'الأحدث',
    loading: 'بنجهز المنتجات…',
    retry: 'إعادة المحاولة',
    noProducts: 'لا توجد منتجات متاحة حالياً',
    addToCart: 'أضف للسلة',
    added: 'اتضاف للسلة',
    productDetails: 'تفاصيل المنتج',
    chooseVariant: 'اختار النوع أو الحجم',
    available: 'متوفر',
    unavailable: 'التوفر يحتاج مراجعة',
    quantity: 'الكمية',
    subtotal: 'الإجمالي المبدئي',
    checkout: 'إكمال الطلب والدفع',
    emptyCart: 'سلتك فاضية حالياً',
    emptyCartBody: 'ابدأ بإضافة المنتجات اللي تحتاجها وسنجهز طلبك.',
    continueShopping: 'ابدأ التسوق',
    clearCart: 'تفريغ السلة',
    chatWelcome: 'هلا! أنا مهندس MIG FARM الزراعي. اكتب سؤالك أو ارفع صورة للنبات أو المنتج.',
    chatPlaceholder: 'اكتب سؤالك هنا…',
    clearChat: 'مسح المحادثة',
    camera: 'الكاميرا',
    gallery: 'الصور',
    analyzing: 'أفهم طلبك وأراجع التفاصيل…',
    chatError: 'حصلت مشكلة في الاتصال. جرّب مرة ثانية.',
    accountTitle: 'حساب MIG FARM',
    signIn: 'تسجيل الدخول',
    orders: 'طلباتي السابقة',
    articles: 'المكتبة الزراعية',
    contact: 'تواصل معنا',
    branches: 'فروعنا',
    language: 'اللغة',
    arabic: 'العربية',
    english: 'English',
    favorites: 'المفضلة',
    remove: 'حذف',
    askAboutProduct: 'اسأل المهندس عن المنتج',
    selectProduct: 'تم اختيار المنتج للمحادثة',
    filters: 'الفلاتر',
    sort: 'ترتيب النتائج',
    featuredSort: 'الأكثر صلة',
    priceLow: 'السعر: من الأقل',
    priceHigh: 'السعر: من الأعلى',
    availableFirst: 'المتوفر أولاً',
    availableOnly: 'المتوفر فقط',
    applyFilters: 'تطبيق الفلاتر',
    resetFilters: 'إعادة ضبط',
    compare: 'مقارنة',
    compareProducts: 'مقارنة المنتجات',
    compareLimit: 'يمكن مقارنة 3 منتجات كحد أقصى',
    noCompare: 'اختر منتجات لمقارنتها',
    recentlyViewed: 'شاهدتها مؤخراً',
    profile: 'بياناتي',
    save: 'حفظ',
    fullName: 'الاسم الكامل',
    phone: 'رقم الهاتف',
    email: 'البريد الإلكتروني',
    addresses: 'عناوين التوصيل',
    addAddress: 'إضافة عنوان',
    addressLabel: 'اسم العنوان',
    city: 'المدينة أو المنطقة',
    addressLine: 'العنوان بالتفصيل',
    defaultAddress: 'العنوان الافتراضي',
    notifications: 'الإشعارات',
    notificationsBody: 'تحكم في تحديثات الطلبات والعروض والنصائح الزراعية.',
    orderUpdates: 'تحديثات الطلبات',
    offers: 'العروض والمنتجات الجديدة',
    farmingTips: 'نصائح زراعية',
    noNotifications: 'لا توجد إشعارات جديدة',
  },
  en: {
    home: 'Home',
    store: 'Store',
    departments: 'Departments',
    assistant: 'Assistant',
    cart: 'Cart',
    account: 'Account',
    welcome: 'Everything you need to grow',
    heroBody: 'Seeds, nutrients, equipment and trusted growing solutions across the UAE',
    shopNow: 'Shop now',
    askEngineer: 'Ask the engineer',
    categories: 'Shop departments',
    featured: 'New arrivals',
    viewAll: 'View all',
    freeShipping: 'Fast shipping across the UAE',
    aiTitle: 'Not sure what to choose?',
    aiBody: 'Share a photo or ask a question and our agricultural assistant will guide you.',
    search: 'Search products, seeds or fertilizers...',
    searchTab: 'Search',
    searchSuggestions: 'Search suggestions',
    recentSearches: 'Recent searches',
    clearRecent: 'Clear history',
    featuredProducts: 'Featured products',
    brands: 'Brand',
    productType: 'Product type',
    priceRange: 'Price range',
    chooseCategory: 'Category',
    allBrands: 'All brands',
    allTypes: 'All types',
    minPrice: 'From',
    maxPrice: 'To',
    popularSort: 'Most ordered',
    newestSort: 'Newest',
    loading: 'Loading products…',
    retry: 'Try again',
    noProducts: 'No matching products found',
    addToCart: 'Add to cart',
    added: 'Added to cart',
    productDetails: 'Product details',
    chooseVariant: 'Choose size or option',
    available: 'Available',
    unavailable: 'Availability needs review',
    quantity: 'Quantity',
    subtotal: 'Subtotal',
    checkout: 'Continue to checkout',
    emptyCart: 'Your cart is empty',
    emptyCartBody: 'Add the products you need, then return here to complete your order.',
    continueShopping: 'Start shopping',
    clearCart: 'Clear cart',
    chatWelcome: 'Hello! I am the MIG FARM agricultural engineer. Ask a question or share a plant or product photo.',
    chatPlaceholder: 'Type your question…',
    clearChat: 'Clear chat',
    camera: 'Camera',
    gallery: 'Photos',
    analyzing: 'Understanding your request and checking details…',
    chatError: 'Connection failed. Please try again.',
    accountTitle: 'MIG FARM account',
    signIn: 'Sign in',
    orders: 'My orders',
    articles: 'Growing library',
    contact: 'Contact us',
    branches: 'Our branches',
    language: 'Language',
    arabic: 'العربية',
    english: 'English',
    favorites: 'Favorites',
    remove: 'Remove',
    askAboutProduct: 'Ask about this product',
    selectProduct: 'Product selected for chat',
    filters: 'Filters',
    sort: 'Sort results',
    featuredSort: 'Most relevant',
    priceLow: 'Price: low to high',
    priceHigh: 'Price: high to low',
    availableFirst: 'Available first',
    availableOnly: 'Available only',
    applyFilters: 'Apply filters',
    resetFilters: 'Reset filters',
    compare: 'Compare',
    compareProducts: 'Compare products',
    compareLimit: 'You can compare up to 3 products',
    noCompare: 'Choose products to compare',
    recentlyViewed: 'Recently viewed',
    profile: 'My details',
    save: 'Save',
    fullName: 'Full name',
    phone: 'Phone number',
    email: 'Email address',
    addresses: 'Delivery addresses',
    addAddress: 'Add address',
    addressLabel: 'Address name',
    city: 'City or area',
    addressLine: 'Full address',
    defaultAddress: 'Default address',
    notifications: 'Notifications',
    notificationsBody: 'Control order updates, offers and growing tips.',
    orderUpdates: 'Order updates',
    offers: 'Offers and new products',
    farmingTips: 'Growing tips',
    noNotifications: 'No new notifications',
  },
} as const;

export type CopyKey = keyof typeof copy.ar;

type LanguageValue = {
  ready: boolean;
  language: Language;
  isRTL: boolean;
  setLanguage: (language: Language) => void;
  t: (key: CopyKey) => string;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => resolveLaunchLanguage(null, getLocales()[0]?.languageTag));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active) setLanguageState(resolveLaunchLanguage(stored, getLocales()[0]?.languageTag));
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const value = useMemo<LanguageValue>(() => ({
    ready,
    language,
    isRTL: language === 'ar',
    setLanguage,
    t: (key) => copy[language][key],
  }), [language, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
