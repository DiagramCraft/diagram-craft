import { useCallback, useEffect, useState } from 'react';

const loadStoredConfig = <T>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value == null ? null : (JSON.parse(value) as T);
  } catch {
    return null;
  }
};

type StoredConfig<T> = {
  storageKey: string;
  config: T | null;
};

export const usePersistedViewConfig = <T>({
  storageKey,
  externalConfig,
  onChange
}: {
  storageKey: string;
  externalConfig: T | null;
  onChange?: (config: T) => void;
}) => {
  const [storedConfig, setStoredConfig] = useState<StoredConfig<T>>(() => ({
    storageKey,
    config: loadStoredConfig<T>(storageKey)
  }));

  useEffect(() => {
    if (storedConfig.storageKey === storageKey) return;
    setStoredConfig({ storageKey, config: loadStoredConfig<T>(storageKey) });
  }, [storageKey, storedConfig.storageKey]);

  const config =
    externalConfig ?? (storedConfig.storageKey === storageKey ? storedConfig.config : null);
  const setConfig = useCallback(
    (next: T) => {
      if (onChange) {
        onChange(next);
        return;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Keep local editing available when browser storage is unavailable or full.
      }
      setStoredConfig({ storageKey, config: next });
    },
    [onChange, storageKey]
  );
  return [config, setConfig] as const;
};
