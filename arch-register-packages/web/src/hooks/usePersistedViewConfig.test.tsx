// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedViewConfig } from './usePersistedViewConfig';

type Config = { id: string };
type HookResult = ReturnType<typeof usePersistedViewConfig<Config>>;

const Harness = ({
  storageKey,
  externalConfig = null,
  onChange,
  resultRef,
  renderedConfigs
}: {
  storageKey: string;
  externalConfig?: Config | null;
  onChange?: (config: Config) => void;
  resultRef: { current: HookResult | null };
  renderedConfigs?: { current: Array<Config | null> };
}) => {
  const result = usePersistedViewConfig<Config>({ storageKey, externalConfig, onChange });
  resultRef.current = result;
  renderedConfigs?.current.push(result[0]);
  return null;
};

describe('usePersistedViewConfig', () => {
  let container: HTMLDivElement;
  let root: Root;
  let storage: Map<string, string>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    storage = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value)
      } satisfies Pick<Storage, 'clear' | 'getItem' | 'setItem'>
    });
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('returns null when storage is missing or contains malformed JSON', () => {
    const missingResult = { current: null as HookResult | null };

    act(() => {
      root.render(<Harness storageKey="missing" resultRef={missingResult} />);
    });

    expect(missingResult.current?.[0]).toBeNull();

    localStorage.setItem('malformed', '{');
    const malformedResult = { current: null as HookResult | null };

    act(() => {
      root.render(<Harness storageKey="malformed" resultRef={malformedResult} />);
    });

    expect(malformedResult.current?.[0]).toBeNull();
  });

  it('reloads storage for a new key without exposing the previous key config', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    localStorage.setItem('workspace-a', JSON.stringify(first));
    localStorage.setItem('workspace-b', JSON.stringify(second));

    const resultRef = { current: null as HookResult | null };
    const renderedConfigs = { current: [] as Array<Config | null> };

    act(() => {
      root.render(
        <Harness storageKey="workspace-a" resultRef={resultRef} renderedConfigs={renderedConfigs} />
      );
    });
    expect(resultRef.current?.[0]).toEqual(first);

    renderedConfigs.current = [];
    act(() => {
      root.render(
        <Harness storageKey="workspace-b" resultRef={resultRef} renderedConfigs={renderedConfigs} />
      );
    });

    expect(renderedConfigs.current[0]).toBeNull();
    expect(resultRef.current?.[0]).toEqual(second);
  });

  it('does not retain the previous config when the new key has no stored value', () => {
    localStorage.setItem('workspace-a', JSON.stringify({ id: 'first' }));
    const resultRef = { current: null as HookResult | null };

    act(() => {
      root.render(<Harness storageKey="workspace-a" resultRef={resultRef} />);
    });
    expect(resultRef.current?.[0]).toEqual({ id: 'first' });

    act(() => {
      root.render(<Harness storageKey="workspace-b" resultRef={resultRef} />);
    });

    expect(resultRef.current?.[0]).toBeNull();
  });

  it('updates local state when persistence fails', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });
    const resultRef = { current: null as HookResult | null };
    const next = { id: 'edited' };

    act(() => {
      root.render(<Harness storageKey="workspace-a" resultRef={resultRef} />);
    });
    act(() => resultRef.current![1](next));

    expect(setItem).toHaveBeenCalledWith('workspace-a', JSON.stringify(next));
    expect(resultRef.current?.[0]).toEqual(next);
  });

  it('falls back safely when storage reads are unavailable', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const resultRef = { current: null as HookResult | null };

    act(() => {
      root.render(<Harness storageKey="workspace-a" resultRef={resultRef} />);
    });

    expect(resultRef.current?.[0]).toBeNull();
  });

  it('keeps external config and onChange precedence over persistence', () => {
    const stored = { id: 'stored' };
    const external = { id: 'external' };
    const next = { id: 'next' };
    localStorage.setItem('workspace-a', JSON.stringify(stored));
    const onChange = vi.fn();
    const resultRef = { current: null as HookResult | null };

    act(() => {
      root.render(
        <Harness
          storageKey="workspace-a"
          externalConfig={external}
          onChange={onChange}
          resultRef={resultRef}
        />
      );
    });

    expect(resultRef.current?.[0]).toEqual(external);
    act(() => resultRef.current![1](next));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(next);
    expect(localStorage.getItem('workspace-a')).toBe(JSON.stringify(stored));
    expect(resultRef.current?.[0]).toEqual(external);
  });
});
