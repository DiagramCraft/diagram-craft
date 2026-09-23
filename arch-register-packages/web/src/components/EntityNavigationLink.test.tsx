// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
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

vi.mock('../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'acme' })
}));

vi.mock('../sections/entities/entityDrawer/useEntityDrawer', () => ({
  useEntityDrawer: () => ({ openEntityDrawer: mocks.openEntityDrawer })
}));

const { EntityNavigationLink } = await import('./EntityNavigationLink');

describe('EntityNavigationLink', () => {
  it('renders an accessible entity anchor with the workspace route', () => {
    const markup = renderToStaticMarkup(
      <EntityNavigationLink publicId="APP-42">Payments API</EntityNavigationLink>
    );

    expect(markup).toContain('href="/acme/entities/APP-42"');
    expect(markup).toContain('Payments API');
  });

  describe('click behavior', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      mocks.openEntityDrawer.mockReset();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it('opens the drawer and prevents navigation on a plain left-click', async () => {
      await act(async () => {
        root.render(<EntityNavigationLink publicId="APP-42">Payments API</EntityNavigationLink>);
      });

      const anchor = container.querySelector('a')!;
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      let prevented = false;
      await act(async () => {
        prevented = !anchor.dispatchEvent(event);
      });

      expect(mocks.openEntityDrawer).toHaveBeenCalledWith('APP-42');
      expect(prevented).toBe(true);
    });

    it('lets a modifier-click fall through to real navigation without opening the drawer', async () => {
      await act(async () => {
        root.render(<EntityNavigationLink publicId="APP-42">Payments API</EntityNavigationLink>);
      });

      const anchor = container.querySelector('a')!;
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true
      });
      let prevented = false;
      await act(async () => {
        prevented = !anchor.dispatchEvent(event);
      });

      expect(mocks.openEntityDrawer).not.toHaveBeenCalled();
      expect(prevented).toBe(false);
    });

    it('respects a caller onClick that already prevented default', async () => {
      await act(async () => {
        root.render(
          <EntityNavigationLink publicId="APP-42" onClick={e => e.preventDefault()}>
            Payments API
          </EntityNavigationLink>
        );
      });

      const anchor = container.querySelector('a')!;
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      await act(async () => {
        anchor.dispatchEvent(event);
      });

      expect(mocks.openEntityDrawer).not.toHaveBeenCalled();
    });
  });
});
