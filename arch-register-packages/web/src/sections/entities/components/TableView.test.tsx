// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openEntityDrawer: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params: Record<string, string>;
    children: React.ReactNode;
  }) => {
    const href = to
      .replace('$workspaceSlug', params.workspaceSlug ?? '')
      .replace('$entityId', params.entityId ?? '');
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'acme' })
}));

vi.mock('../entityDrawer/useEntityDrawer', () => ({
  useEntityDrawer: () => ({ openEntityDrawer: mocks.openEntityDrawer })
}));

const { TableView } = await import('./TableView');

const entity = {
  _uid: 'e1',
  _publicId: 'APP-1',
  _name: 'Payments API',
  _schema: { id: 'service' },
  canCreateChild: false
} as unknown as Parameters<typeof TableView>[0]['rows'][number];

const baseProps = {
  rows: [entity],
  schemaMap: new Map(),
  lifecycleStates: [],
  onDelete: vi.fn(),
  onClone: vi.fn(),
  config: {},
  displayFields: []
};

describe('TableView', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onEntityClick: (entityId: string) => void;

  beforeEach(() => {
    mocks.openEntityDrawer.mockReset();
    onEntityClick = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens the drawer via a real anchor when the entity name is clicked', async () => {
    await act(async () => {
      root.render(<TableView {...baseProps} onEntityClick={onEntityClick} />);
    });

    const link = container.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/acme/entities/APP-1');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => {
      link.dispatchEvent(event);
    });

    expect(mocks.openEntityDrawer).toHaveBeenCalledWith('APP-1');
    // The row's own onClick (the click-anywhere convenience) shouldn't double-fire — the link
    // click stops propagation before it reaches the row.
    expect(onEntityClick).not.toHaveBeenCalled();
  });

  it('still opens the drawer via the row-level handler when clicking elsewhere in the row', async () => {
    await act(async () => {
      root.render(<TableView {...baseProps} onEntityClick={onEntityClick} />);
    });

    const row = container.querySelector('tr[aria-label^="Entity row"]')!;
    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEntityClick).toHaveBeenCalledWith('APP-1');
  });
});
