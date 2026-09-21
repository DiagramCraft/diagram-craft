import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VendorDrawer } from './VendorDrawer';

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: ({
    workspaceSlug,
    entityId,
    loadingMessage,
    unavailableMessage
  }: {
    workspaceSlug: string;
    entityId: string;
    loadingMessage: ReactNode;
    unavailableMessage: ReactNode;
  }) => (
    <div>
      <span>{workspaceSlug}</span>
      <span>{entityId}</span>
      <span>{loadingMessage}</span>
      <span>{unavailableMessage}</span>
    </div>
  )
}));

describe('VendorDrawer', () => {
  it('delegates to the shared drawer with vendor-specific state messages', () => {
    const markup = renderToStaticMarkup(
      <VendorDrawer workspaceSlug="workspace-1" vendorId="VND-001" onClose={() => undefined} />
    );

    expect(markup).toContain('workspace-1');
    expect(markup).toContain('VND-001');
    expect(markup).toContain('Loading vendor…');
    expect(markup).toContain('This vendor is unavailable.');
  });
});
