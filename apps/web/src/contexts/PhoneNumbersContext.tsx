import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listPhoneNumbers } from '@/lib/api';

export interface UserPhoneNumber {
  id: string;
  phone_number: string;
  telnyx_phone_number_id: string;
  created_at: string;
}

interface PhoneNumbersContextValue {
  numbers: UserPhoneNumber[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PhoneNumbersContext = createContext<PhoneNumbersContextValue | null>(null);

export function PhoneNumbersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [numbers, setNumbers] = useState<UserPhoneNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPhoneNumbers();
      setNumbers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // On sign-out: clear cache
  useEffect(() => {
    if (!user) {
      setNumbers([]);
      setError(null);
      setLoading(false);
    }
  }, [user]);

  // On sign-in: preload phone numbers once (only when cache is empty)
  useEffect(() => {
    if (!user) return;
    if (numbers.length > 0) return; // already have cached data
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPhoneNumbers()
      .then((list) => {
        if (!cancelled) setNumbers(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setNumbers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when user is set; skip when numbers already populated
  }, [user]);

  const value: PhoneNumbersContextValue = {
    numbers,
    loading,
    error,
    refetch,
  };

  return <PhoneNumbersContext.Provider value={value}>{children}</PhoneNumbersContext.Provider>;
}

export function usePhoneNumbers() {
  const ctx = useContext(PhoneNumbersContext);
  if (!ctx) throw new Error('usePhoneNumbers must be used within PhoneNumbersProvider');
  return ctx;
}
