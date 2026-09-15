// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryConsoleSubSection } from './QueryConsoleSubSection';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  run: vi.fn()
}));

vi.mock('@diagram-craft/app-components/Button', () => ({
  Button: ({
    children,
    disabled,
    onClick
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}));

vi.mock('@diagram-craft/app-components/TextArea', () => ({
  TextArea: ({
    value,
    onChange,
    ...props
  }: {
    value: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <textarea {...props} value={value} onChange={event => onChange?.(event.currentTarget.value)} />
  )
}));

vi.mock('../../../hooks/useEntityQueryText', () => ({
  useParseEntityQueryText: () => ({ mutateAsync: mocks.parse, isPending: false }),
  useRunEntityQuery: () => ({ mutateAsync: mocks.run, isPending: false })
}));

const query = {
  root: { kind: 'freeText' as const, value: 'Component' }
};

const setText = (textarea: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('QueryConsoleSubSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.parse.mockReset();
    mocks.run.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () => {
    act(() => {
      root.render(<QueryConsoleSubSection workspaceId="workspace-1" />);
    });
  };

  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('parses and executes a query, showing compact raw items and the total', async () => {
    const items = [{ _uid: 'entity-1', _name: 'Component' }];
    mocks.parse.mockResolvedValue({ ok: true, query });
    mocks.run.mockResolvedValue({ items, total: 1 });
    render();

    const textarea = container.querySelector('textarea')!;
    setText(textarea, 'schema:Component');
    await act(async () => {
      container.querySelector('button')!.click();
      await flush();
    });

    expect(mocks.parse).toHaveBeenCalledWith('schema:Component');
    expect(mocks.run).toHaveBeenCalledWith(query);
    expect(container.querySelector('pre')?.textContent).toBe(JSON.stringify(items, null, 2));
    expect(container.textContent).toContain('1 record(s) returned');
  });

  it('renders parse errors inline without executing the query', async () => {
    mocks.parse.mockResolvedValue({
      ok: false,
      errors: [{ offset: 7, message: 'Unknown schema' }]
    });
    render();

    const textarea = container.querySelector('textarea')!;
    setText(textarea, 'schema:Missing');
    await act(async () => {
      container.querySelector('button')!.click();
      await flush();
    });

    expect(container.textContent).toContain('Query error at offset 7: Unknown schema');
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('renders execution errors inline', async () => {
    mocks.parse.mockResolvedValue({ ok: true, query });
    mocks.run.mockRejectedValue(new Error('Failed to retrieve data'));
    render();

    const textarea = container.querySelector('textarea')!;
    setText(textarea, 'schema:Component');
    await act(async () => {
      container.querySelector('button')!.click();
      await flush();
    });

    expect(container.textContent).toContain('Failed to retrieve data');
  });
});
