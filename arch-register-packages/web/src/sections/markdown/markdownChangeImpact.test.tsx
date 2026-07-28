// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownChangeImpactDialog, type MarkdownSaveIntent } from './MarkdownChangeImpactDialog';
import { hasWorkflowFields } from './markdownChangeImpact';

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({
    open,
    title,
    children,
    buttons = []
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
    buttons?: Array<{ label: string; onClick: () => void }>;
  }) =>
    open ? (
      <div role="dialog">
        <h1>{title}</h1>
        {children}
        {buttons.map(button => (
          <button key={button.label} type="button" onClick={button.onClick}>
            {button.label}
          </button>
        ))}
      </div>
    ) : null
}));

describe('hasWorkflowFields', () => {
  it('recognizes active workflow fields', () => {
    expect(hasWorkflowFields([{ isStatus: true }])).toBe(true);
  });

  it('ignores non-workflow and retired fields', () => {
    expect(hasWorkflowFields([{ isStatus: false }, { isStatus: true, retired: true }])).toBe(false);
    expect(hasWorkflowFields([])).toBe(false);
  });
});

describe('MarkdownChangeImpactDialog', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it.each([
    ['save', 'Save'],
    ['save-and-close', 'Save & Close']
  ] as Array<
    [MarkdownSaveIntent, string]
  >)('keeps the originating action for %s', (intent, label) => {
    const onConfirm = vi.fn();

    act(() => {
      root.render(
        <MarkdownChangeImpactDialog
          open
          intent={intent}
          changeKind="minor"
          onChangeKind={vi.fn()}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      );
    });

    expect(container.textContent).toContain(label);
    const select = container.querySelector('select');
    expect(select).not.toBeNull();
    expect((select as HTMLSelectElement).value).toBe('minor');

    act(() => {
      (select as HTMLSelectElement).value = 'major';
      select?.dispatchEvent(new Event('change', { bubbles: true }));
      container
        .querySelector(`button:last-of-type`)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
