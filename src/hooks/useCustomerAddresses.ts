import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCommerce } from '@/contexts/CommerceContext';
import { customerService } from '@/services/customer';
import type { SavedAddress } from '@/types';

export function useCustomerAddresses() {
  const { user } = useAuth();
  const commerce = useCommerce();
  const owner = user?.id;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [remote, setRemote] = useState<SavedAddress[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const addresses = await customerService.listAddresses();
      if (currentOwner.current !== owner) return;
      setRemote(addresses);
      setLoadedOwner(owner);
    } catch {
      if (currentOwner.current === owner) setError(true);
    } finally {
      if (currentOwner.current === owner) setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    setRemote([]);
    setError(false);
    setLoading(false);
    void reload();
  }, [reload]);
  const updateRemote = async (operation: Promise<SavedAddress[]>) => {
    const next = await operation;
    if (currentOwner.current === owner) {
      setRemote(next);
      setLoadedOwner(owner);
    }
  };
  return {
    addresses: user
      ? loadedOwner === owner
        ? remote
        : []
      : commerce.addresses,
    loading: loading || !commerce.hydrated,
    error,
    reload,
    save: async (address: Omit<SavedAddress, 'id'> & { id?: string }) => {
      if (user)
        await updateRemote(
          customerService.saveAddress({
            ...address,
            id: address.id || '',
          }),
        );
      else commerce.saveAddress(address);
    },
    remove: async (id: string) => {
      if (user) await updateRemote(customerService.deleteAddress(id));
      else commerce.removeAddress(id);
    },
    makeDefault: async (id: string) => {
      if (user) {
        const address = remote.find((item) => item.id === id);
        if (address)
          await updateRemote(
            customerService.saveAddress({ ...address, isDefault: true }),
          );
      } else commerce.setDefaultAddress(id);
    },
  };
}
