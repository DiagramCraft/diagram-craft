// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryPreview } from './QueryPreview';

describe('QueryPreview', () => {
  let container: HTMLDivElement;
  let root: Root;
  let clipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined
      });
    }
  });

  it('preserves multiline text and copies the exact preview', async () => {
    const text = 'schema:Component AND\n  eol_date < date("2026-06-30")';
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    act(() => root.render(<QueryPreview text={text} />));

    expect(container.querySelector('pre')?.textContent).toBe(text);
    await act(async () => {
      container.querySelector('button')!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(text);
    expect(container.textContent).toContain('Copied');
  });

  it('disables copying for an empty query', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    act(() => root.render(<QueryPreview text="" />));

    const button = container.querySelector('button')!;
    expect(button).toHaveProperty('disabled', true);
    act(() => button.click());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not throw when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    act(() => root.render(<QueryPreview text="schema:Component" />));

    await act(async () => {
      container.querySelector('button')!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Copy');
    expect(container.textContent).not.toContain('Copied');
  });
});
