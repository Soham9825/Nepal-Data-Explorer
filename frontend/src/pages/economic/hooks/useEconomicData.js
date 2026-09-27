/**
 * Loads the economic payload.
 *
 * One request returns all nine series, so this owns the request lifecycle and
 * nothing else: `retry` re-runs the fetch with a bumped version, which is the only
 * knob the error state needs. Province GDP is a separate endpoint with its own
 * lifecycle — see `useProvinceGdpData`.
 */
import { useEffect, useState } from 'react';
import { ECONOMIC_API } from '../constants';

export function useEconomicData() {
  const [requestVersion, setRequestVersion] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    fetch(ECONOMIC_API, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`Economic API error: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((requestError) => {
        console.warn('Could not load economic data', requestError);
        if (mounted) {
          setData(null);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [requestVersion]);

  return {
    data,
    loading,
    error,
    retry: () => setRequestVersion((version) => version + 1),
  };
}
