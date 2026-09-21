import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContractDrawer } from './ContractDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  drawerProps: undefined as
    | {
        onOpenRelatedEntity?: (fieldId: string, publicId: string) => boolean;
        additionalBadges?: ReactNode | ((entity: Record<string, unknown>) => ReactNode);
        loadingMessage: ReactNode;
        unavailableMessage: ReactNode;
      }
    | undefined
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.drawerProps) => {
    mocks.drawerProps = props;
    return (
      <div>
        <span>{props?.loadingMessage}</span>
        <span>{props?.unavailableMessage}</span>
        {typeof props?.additionalBadges === 'function'
          ? props.additionalBadges({ contract_end: '2026-09-30' })
          : props?.additionalBadges}
      </div>
    );
  }
}));

describe('ContractDrawer', () => {
  it('delegates to the shared drawer with contract state messages and renewal badge', () => {
    const markup = renderToStaticMarkup(
      <ContractDrawer workspaceSlug="workspace-1" contractId="CTR-001" onClose={() => undefined} />
    );

    expect(markup).toContain('Loading contract…');
    expect(markup).toContain('This contract is unavailable.');
    expect(markup).toContain('Next 30 days');
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
