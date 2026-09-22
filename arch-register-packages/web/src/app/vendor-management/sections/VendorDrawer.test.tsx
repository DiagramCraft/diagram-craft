import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VendorDrawer } from './VendorDrawer';

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: ({
    workspaceSlug,
    entityId,
    entityLabel
  }: {
    workspaceSlug: string;
    entityId: string;
    entityLabel: string;
  }) => (
    <div>
      <span>{workspaceSlug}</span>
      <span>{entityId}</span>
      <span>{entityLabel}</span>
    </div>
  )
}));

describe('VendorDrawer', () => {
  it('delegates to the shared drawer with the vendor entity label', () => {
    const markup = renderToStaticMarkup(
      <VendorDrawer workspaceSlug="workspace-1" vendorId="VND-001" onClose={() => undefined} />
    );

    expect(markup).toContain('workspace-1');
    expect(markup).toContain('VND-001');
    expect(markup).toContain('vendor');
  });
});
