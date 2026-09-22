import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ApiSpecDrawer } from './ApiSpecDrawer';

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: { workspaceSlug: string; entityId: string; entityLabel: string }) => (
    <div>
      <span>{props.workspaceSlug}</span>
      <span>{props.entityId}</span>
      <span>{props.entityLabel}</span>
    </div>
  )
}));

describe('ApiSpecDrawer', () => {
  it('keeps the API drawer adapter bound to the shared entity renderer', () => {
    const markup = renderToStaticMarkup(
      <ApiSpecDrawer workspaceSlug="workspace-1" apiId="API-001" onClose={vi.fn()} />
    );

    expect(markup).toContain('workspace-1');
    expect(markup).toContain('API-001');
    expect(markup).toContain('API');
  });
});
