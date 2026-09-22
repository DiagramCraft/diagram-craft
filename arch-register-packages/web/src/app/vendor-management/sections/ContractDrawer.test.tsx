import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContractDrawer } from './ContractDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  drawerProps: undefined as
    | {
        entityId: string;
        entityLabel?: string;
        onOpenRelatedEntity?: (fieldId: string, publicId: string) => boolean;
      }
    | undefined
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.drawerProps) => {
    mocks.drawerProps = props;
    return <div>shared entity drawer</div>;
  }
}));

describe('ContractDrawer', () => {
  it('delegates to the shared drawer with the contract entity label', () => {
    const markup = renderToStaticMarkup(
      <ContractDrawer workspaceSlug="workspace-1" contractId="CTR-001" onClose={() => undefined} />
    );

    expect(markup).toContain('shared entity drawer');
    expect(mocks.drawerProps?.entityId).toBe('CTR-001');
    expect(mocks.drawerProps?.entityLabel).toBe('contract');
  });

  it('keeps Vendor Management navigation for the vendor relation', () => {
    renderToStaticMarkup(
      <ContractDrawer workspaceSlug="workspace-1" contractId="CTR-001" onClose={() => undefined} />
    );

    expect(mocks.drawerProps?.onOpenRelatedEntity?.('vendor', 'VND-001')).toBe(true);
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/vendors/$vendorId',
        params: { workspaceSlug: 'workspace-1', vendorId: 'VND-001' }
      })
    );
    expect(mocks.drawerProps?.onOpenRelatedEntity?.('other', 'ENT-001')).toBe(false);
  });
});
