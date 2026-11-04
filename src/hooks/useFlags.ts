import { useEffect, useState } from "react";
import { DEFAULT_FLAGS, FlagsService, type AppFlags } from "../services/FlagsService";

export function useFlags(): AppFlags {
  const [flags, setFlags] = useState<AppFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    const unsub = FlagsService.subscribeToFlags(
      setFlags,
      () => setFlags(DEFAULT_FLAGS),
    );
    return unsub;
  }, []);

  return flags;
}
