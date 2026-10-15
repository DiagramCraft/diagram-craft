import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { BlastRadiusPanel } from '../../../sections/entities/components/BlastRadiusPanel';
import { BlastRadiusWidgetConfig } from './types';

export const BlastRadiusWidget = ({ config }: { config: BlastRadiusWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const entityId = config.entityId ?? '';
  const { data: entity, isLoading } = useEntity(workspaceSlug, entityId, entityId !== '');
  const schemas = useSchemas(workspaceSlug);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);

  if (entityId === '') {
    return (
      <EmptyState
        title="No entity selected"
        subtitle="Edit this widget to choose the entity whose blast radius to show."
      />
    );
  }
  if (isLoading || !entity) {
    return isLoading ? (
      <LoadingState text="Loading entity…" size="sm" />
    ) : (
      <EmptyState title="Entity not found" subtitle="The selected entity no longer exists." />
    );
  }

  return (
    <BlastRadiusPanel
      workspaceId={workspaceSlug}
      subject={{ kind: 'entity', entityId: entity._uid }}
      schemas={schemas.data ?? []}
      lifecycleStates={lifecycleStates}
      embedded
    />
  );
};
