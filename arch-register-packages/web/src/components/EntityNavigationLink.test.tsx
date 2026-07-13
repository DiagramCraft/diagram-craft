import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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

const { EntityNavigationLink } = await import('./EntityNavigationLink');

describe('EntityNavigationLink', () => {
  it('renders an accessible entity anchor with the workspace route', () => {
    const markup = renderToStaticMarkup(
      <EntityNavigationLink publicId="APP-42">Payments API</EntityNavigationLink>
    );

    expect(markup).toContain('<a href="/acme/entities/APP-42">Payments API</a>');
  });
});
