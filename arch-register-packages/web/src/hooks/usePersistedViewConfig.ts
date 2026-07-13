import { useCallback, useState } from 'react';

const loadStoredConfig = <T>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
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
  const [storedConfig, setStoredConfig] = useState<T | null>(() => loadStoredConfig<T>(storageKey));
  const config = externalConfig ?? storedConfig;
  const setConfig = useCallback(
    (next: T) => {
      if (onChange) {
        onChange(next);
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStoredConfig(next);
    },
    [onChange, storageKey]
  );
  return [config, setConfig] as const;
};
