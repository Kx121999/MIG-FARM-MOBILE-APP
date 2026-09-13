import { useCallback, useEffect, useState } from 'react';
import { fetchCatalog } from '@/services/catalog';
import { Product, StoreCategory } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchCatalog(force);
      setProducts(catalog.products);
      setCategories(catalog.categories);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'store_unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { products, categories, loading, error, reload: () => load(true) };
}
