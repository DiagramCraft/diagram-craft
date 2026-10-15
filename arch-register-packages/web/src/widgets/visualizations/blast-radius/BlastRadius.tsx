import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { BlastRadiusPanel } from '../../../sections/entities/components/BlastRadiusPanel';
import {
  BLAST_RADIUS_DEFAULT_MAX_DEPTH,
  buildBlastRadiusGroupPaths,
  buildBlastRadiusGroups
} from './blastRadiusGroups';
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

  const groups = config.groups && config.groups.length > 0 ? config.groups : undefined;
  const entitySchema = (schemas.data ?? []).find(schema => schema.id === entity._schema?.id);

  return (
    <BlastRadiusPanel
      workspaceId={workspaceSlug}
      subject={{ kind: 'entity', entityId: entity._uid }}
      {...(groups
        ? {
            paths: buildBlastRadiusGroupPaths(entitySchema, groups),
            groups: buildBlastRadiusGroups(groups),
            showFilters: false,
            maxDepth: config.maxDepth ?? BLAST_RADIUS_DEFAULT_MAX_DEPTH,
            noPathsState: {
              title: 'Impact cannot be computed',
              subtitle: `This entity type has none of the configured relation fields (${groups
                .map(group => group.fieldName)
                .join(', ')}).`
            }
          }
        : {})}
      schemas={schemas.data ?? []}
      lifecycleStates={lifecycleStates}
      embedded
    />
  );
};
