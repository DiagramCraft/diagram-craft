// @vitest-environment jsdom
import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoFocus } from './useAutoFocus';
import { useCancellableTimeout } from './useCancellableTimeout';

const AutoFocusHarness = (props: {
  enabled?: boolean;
  delay?: number;
  trigger?: unknown;
  onFocused?: (element: HTMLInputElement) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useAutoFocus(ref, props);
  return <input ref={ref} />;
};

const DeferredHarness = (props: { callback: () => void }) => {
  const { cancel, schedule } = useCancellableTimeout();

  useEffect(() => {
    schedule(props.callback, 25);
    return cancel;
  }, [cancel, props.callback, schedule]);

  return null;
};

describe('useAutoFocus', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('focuses after the configured delay', () => {
    const onFocused = vi.fn();

    act(() => {
      root.render(<AutoFocusHarness delay={30} onFocused={onFocused} />);
    });

    act(() => vi.advanceTimersByTime(29));
    expect(document.activeElement).not.toBe(container.querySelector('input'));

    act(() => vi.advanceTimersByTime(1));
    expect(document.activeElement).toBe(container.querySelector('input'));
    expect(onFocused).toHaveBeenCalledOnce();
  });

  it('cancels when disabled or unmounted', () => {
    const onFocused = vi.fn();

    act(() => {
      root.render(<AutoFocusHarness delay={30} onFocused={onFocused} />);
    });
    act(() => {
      root.render(<AutoFocusHarness enabled={false} delay={30} onFocused={onFocused} />);
    });
    act(() => vi.advanceTimersByTime(30));
    expect(onFocused).not.toHaveBeenCalled();

    act(() => {
      root.render(<AutoFocusHarness delay={30} onFocused={onFocused} />);
      root.unmount();
      vi.advanceTimersByTime(30);
    });
    expect(onFocused).not.toHaveBeenCalled();
  });

  it('reschedules when its trigger changes', () => {
    const onFocused = vi.fn();

    act(() => {
      root.render(<AutoFocusHarness delay={30} trigger="first" onFocused={onFocused} />);
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    act(() => {
      root.render(<AutoFocusHarness delay={30} trigger="second" onFocused={onFocused} />);
    });
    act(() => vi.advanceTimersByTime(20));
    expect(onFocused).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(10));
    expect(onFocused).toHaveBeenCalledOnce();
  });

  it('runs post-focus behavior after focusing', () => {
    const onFocused = vi.fn((element: HTMLInputElement) => element.select());

    act(() => {
      root.render(<AutoFocusHarness onFocused={onFocused} />);
    });
    act(() => vi.runOnlyPendingTimers());

    expect(onFocused).toHaveBeenCalledWith(container.querySelector('input'));
  });
});

describe('useCancellableTimeout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('cancels a scheduled callback when the owner unmounts', () => {
    const callback = vi.fn();

    act(() => {
      root.render(<DeferredHarness callback={callback} />);
    });
    act(() => {
      root.unmount();
      vi.advanceTimersByTime(25);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
