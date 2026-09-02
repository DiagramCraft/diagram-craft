// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedQueryEditor } from './AdvancedQueryEditor';

describe('AdvancedQueryEditor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderEditor = (
    overrides: Partial<React.ComponentProps<typeof AdvancedQueryEditor>> = {}
  ) => {
    const props: React.ComponentProps<typeof AdvancedQueryEditor> = {
      value: 'schema:Component',
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      onFormat: vi.fn(),
      onClear: vi.fn(),
      ...overrides
    };
    act(() => root.render(<AdvancedQueryEditor {...props} />));
    return props;
  };

  it('only applies the query for Ctrl/Cmd+Enter', () => {
    const { onSubmit } = renderEditor();
    const textarea = container.querySelector('textarea')!;

    const plainEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    act(() => textarea.dispatchEvent(plainEnter));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(plainEnter.defaultPrevented).toBe(false);

    const modifiedEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    act(() => textarea.dispatchEvent(modifiedEnter));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(modifiedEnter.defaultPrevented).toBe(true);
  });

  it('exposes formatting, clearing, and validation feedback', () => {
    const { onFormat, onClear } = renderEditor({ error: 'Expected a value' });
    const buttons = [...container.querySelectorAll('button')];

    act(() => buttons.find(button => button.textContent === 'Format')!.click());
    act(() => buttons.find(button => button.textContent === 'Clear')!.click());

    expect(onFormat).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Expected a value');
  });

  it('disables formatting while a formatting request is pending', () => {
    renderEditor({ formatPending: true });

    expect(container.querySelector('button')!).toHaveProperty('disabled', true);
  });
});
