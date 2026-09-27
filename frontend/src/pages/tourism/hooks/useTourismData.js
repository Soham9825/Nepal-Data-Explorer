/**
 * Loads the whole tourism payload in one request.
 *
 * The dashboard reads from a single analytics endpoint, so this owns the request
 * lifecycle and nothing else: `retry` re-runs the fetch with a bumped version,
 * which is the only knob the error state needs.
 */
import { useEffect, useState } from 'react';
import { tourismAPI } from '../../../services/tourismAPI';

const LOAD_ERROR = 'Tourism data could not be loaded. Check the service connection and try again.';

export function useTourismData() {
  const [requestVersion, setRequestVersion] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    tourismAPI
      .getDashboardData()
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((requestError) => {
        console.warn('Could not load tourism data', requestError);
        if (mounted) {
          setData(null);
          setError(LOAD_ERROR);
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
