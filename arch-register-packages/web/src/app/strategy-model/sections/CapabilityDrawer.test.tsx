import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CapabilityDrawer } from './CapabilityDrawer';

const mocks = vi.hoisted(() => ({
  entityDrawerProps: undefined as
    | {
        entityId: string;
        onOpenEntity?: (id: string) => void;
        entityLabel?: string;
      }
    | undefined
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.entityDrawerProps) => {
    mocks.entityDrawerProps = props;
    return <div>shared entity drawer</div>;
  }
}));

describe('CapabilityDrawer', () => {
  it('adapts the Strategy route to the shared entity drawer', () => {
    const onOpenCapability = vi.fn();
    const markup = renderToStaticMarkup(
      <CapabilityDrawer
        workspaceSlug="workspace-1"
        capabilityId="CAP-001"
        onClose={vi.fn()}
        onOpenCapability={onOpenCapability}
      />
    );

    expect(markup).toContain('shared entity drawer');
    expect(mocks.entityDrawerProps).toMatchObject({
      entityId: 'CAP-001',
      entityLabel: 'capability'
    });
    mocks.entityDrawerProps?.onOpenEntity?.('child-1');
    expect(onOpenCapability).toHaveBeenCalledWith('child-1');
  });
});
