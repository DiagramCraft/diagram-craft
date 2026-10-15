import { useState } from 'react';
import { z } from 'zod';

import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { EmptyState } from '../../../components/EmptyState';
import { EntityPicker } from '../../../components/EntityPicker';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { BlastRadiusPanel } from '../../../sections/entities/components/BlastRadiusPanel';

// `entityId` is the entity's public id, as chosen in the EntityPicker.
export const blastRadiusWidgetConfigSchema = z.object({
  /** Public id of the entity to start from; usually a sidebar variable reference. */
  entityId: z.string().optional()
});

type BlastRadiusWidgetConfig = z.infer<typeof blastRadiusWidgetConfigSchema>;

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

export const BlastRadiusConfigForm = ({
  config,
  onChange
}: {
  config: BlastRadiusWidgetConfig;
  onChange: (config: BlastRadiusWidgetConfig) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [entityId, setEntityId] = useState(config.entityId ?? '');
  const { data: entity } = useEntity(workspaceSlug, entityId, entityId !== '');

  const commit = (next: BlastRadiusWidgetConfig) => onChange(next);

  return (
    <DialogSection label="Entity">
      <EntityPicker
        selectedEntityId={entityId}
        selectedEntity={entity}
        onSelectEntity={selected => {
          setEntityId(selected._publicId);
          commit({ ...config, entityId: selected._publicId });
        }}
        onClearEntity={() => {
          setEntityId('');
          commit({ ...config, entityId: undefined });
        }}
      />
    </DialogSection>
  );
};
