/**
 * Loads the province-wise GDP payload.
 *
 * A separate endpoint from the main economic one, so it carries its own
 * loading and error state: the rest of the page is usable while this is still in
 * flight, and a failure here should read as one empty section rather than a
 * broken dashboard.
 */
import { useEffect, useState } from 'react';
import { fetchProvinceGDP } from '../../../services/provinceGDP';

export function useProvinceGdpData() {
  const [requestVersion, setRequestVersion] = useState(0);
  const [provinceGdp, setProvinceGdp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    fetchProvinceGDP()
      .then((payload) => {
        if (mounted) setProvinceGdp(payload);
      })
      .catch((requestError) => {
        console.warn('Could not load province GDP data', requestError);
        if (mounted) {
          setProvinceGdp(null);
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
    provinceGdp,
    loading,
    error,
    retry: () => setRequestVersion((version) => version + 1),
  };
}
