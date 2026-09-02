export type Language = 'ar' | 'en';

export type ProductImage = {
  id: number;
  src: string;
  alt?: string | null;
  width?: number;
  height?: number;
};

export type ProductVariant = {
  id: number;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  price: string;
  compare_at_price?: string | null;
  available?: boolean;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  featured_image?: ProductImage | null;
};

export type Product = {
  id: number;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  handle: string;
  body_html: string;
  body_html_ar?: string | null;
  body_html_en?: string | null;
  vendor: string;
  product_type: string;
  product_type_ar?: string | null;
  product_type_en?: string | null;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  published_at?: string;
  updated_at?: string;
};

export type CartItem = {
  key: string;
  productId: number;
  handle: string;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  image: string | null;
  variant: ProductVariant;
  quantity: number;
};

export type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
};

export type SavedAddress = {
  id: string;
  label: string;
  emirate: string;
  city: string;
  addressLine: string;
  isDefault: boolean;
};

export type AIProductResult = {
  name: string;
  sku?: string;
  external_id?: string;
  product_id?: number | null;
  product_template_id?: number | null;
  price?: string | number | null;
  currency?: string;
  availability?: string;
  url?: string;
  image?: string;
  description?: string;
  truth?: { current?: boolean; source?: string };
};

export type ChatImage = {
  type: 'input_image';
  image_url: string;
  detail: 'high';
  client_image_id: string;
  capture_target?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  images?: string[];
  results?: AIProductResult[];
};

export type SelectedProductContext = {
  name: string;
  sku?: string;
  external_id?: string;
  product_id?: number | null;
  price?: string;
  currency?: string;
  availability?: string;
  url?: string;
  image?: string;
  truth?: { current: boolean; source: string };
};
