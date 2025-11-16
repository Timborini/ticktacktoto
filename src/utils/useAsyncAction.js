import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Standardize async action UX: loading flag, error toast, optional success toast.
 * Returns [run, loading]
 */
export default function useAsyncAction(defaultError = 'Something went wrong') {
  const [loading, setLoading] = useState(false);
  const run = useCallback(async (fn, { successMessage, errorMessage } = {}) => {
    setLoading(true);
    try {
      const result = await fn();
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (e) {
      toast.error(errorMessage || defaultError);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [defaultError]);
  return [run, loading];
}


