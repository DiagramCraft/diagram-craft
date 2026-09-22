import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DatasetDrawer } from './DatasetDrawer';

const mocks = vi.hoisted(() => ({
  drawerProps: undefined as
    | {
        workspaceSlug: string;
        entityId: string;
        loadingMessage?: unknown;
        unavailableMessage?: unknown;
        onOpenGovernanceCase?: (caseId: string) => void;
      }
    | undefined
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.drawerProps) => {
    mocks.drawerProps = props;
    return <div>shared entity drawer</div>;
  }
}));

describe('DatasetDrawer', () => {
  it('delegates Data Entity rendering to the shared configurable drawer', () => {
    const onOpenCase = vi.fn();
    const markup = renderToStaticMarkup(
      <DatasetDrawer
        workspaceSlug="workspace-1"
        datasetId="dataset-1"
        onClose={vi.fn()}
        onOpenCase={onOpenCase}
      />
    );

    expect(markup).toContain('shared entity drawer');
    expect(mocks.drawerProps?.workspaceSlug).toBe('workspace-1');
    expect(mocks.drawerProps?.entityId).toBe('dataset-1');
    expect(mocks.drawerProps?.loadingMessage).toBe('Loading dataset…');
    expect(mocks.drawerProps?.unavailableMessage).toBe('This dataset is unavailable.');
    expect(mocks.drawerProps?.onOpenGovernanceCase).toBe(onOpenCase);
  });
});
