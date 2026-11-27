import { useCallback, useState } from "react";
import { ErrorService } from "../services/ErrorService";

export function useListenerError(name: string) {
  const [errored, setErrored] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleError = useCallback(
    (error: unknown) => {
      setErrored(true);
      void ErrorService.logListener(name, error);
    },
    [name],
  );

  const retry = useCallback(() => {
    setErrored(false);
    setRetryKey((key) => key + 1);
  }, []);

  return { errored, retryKey, handleError, retry };
}
