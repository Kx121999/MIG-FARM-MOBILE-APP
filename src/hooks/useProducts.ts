import { useCallback, useEffect, useState } from 'react';
import { fetchAllProducts } from '@/services/catalog';
import { Product } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await fetchAllProducts(force));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'store_unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { products, loading, error, reload: () => load(true) };
}
