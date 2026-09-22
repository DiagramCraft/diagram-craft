import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContractDrawer } from './ContractDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  openEntityDrawer: vi.fn(),
  drawerProps: undefined as
    | {
        entityId: string;
        entityLabel?: string;
        onOpenEntity?: (entityId: string) => void;
      }
    | undefined
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => ({})
}));

vi.mock('../../../sections/entities/entityDrawer/useEntityDrawer', () => ({
  useEntityDrawer: () => ({ openEntityDrawer: mocks.openEntityDrawer })
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

  it('uses the shared nested drawer opener for the vendor relation', () => {
    renderToStaticMarkup(
      <ContractDrawer workspaceSlug="workspace-1" contractId="CTR-001" onClose={() => undefined} />
    );

    mocks.drawerProps?.onOpenEntity?.('VND-001');
    expect(mocks.openEntityDrawer).toHaveBeenCalledWith('VND-001');
  });
});
