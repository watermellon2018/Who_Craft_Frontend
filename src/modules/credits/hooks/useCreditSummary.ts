import {useCallback, useEffect, useState} from 'react';

import type {CreditSummary} from '../../../api/generated/contracts';
import {
  CREDIT_BALANCE_UPDATED_EVENT,
  fetchCreditSummary,
} from '../api/creditApi';

export interface CreditSummaryState {
  summary: CreditSummary | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
}

export function useCreditSummary(): CreditSummaryState {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setError(false);
    try {
      setSummary(await fetchCreditSummary());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handleUpdate = () => void reload();
    window.addEventListener(CREDIT_BALANCE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CREDIT_BALANCE_UPDATED_EVENT, handleUpdate);
  }, [reload]);

  return {summary, loading, error, reload};
}

