import { useState } from 'react';
import { TbTopologyStar3 } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { EmptyState } from '../../../components/EmptyState';
import { EntityPicker } from '../../../components/EntityPicker';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { BlastRadiusPanel } from '../../entities/components/BlastRadiusPanel';

export const BLAST_RADIUS_WIDGET_TYPE = 'blast-radius';

// `entityId` is the entity's public id, as chosen in the EntityPicker.
type BlastRadiusWidgetConfig = Record<string, unknown> & { entityId?: string };

const isValidConfig = (config: Record<string, unknown>): config is BlastRadiusWidgetConfig =>
  config.entityId === undefined || typeof config.entityId === 'string';

const BlastRadiusWidget = ({ config }: { config: BlastRadiusWidgetConfig }) => {
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

const BlastRadiusConfigForm = ({
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

const blastRadiusDashboardSpec: Omit<
  DashboardWidgetSpec<BlastRadiusWidgetConfig>,
  'label' | 'description'
> = {
  icon: TbTopologyStar3,
  defaultW: 6,
  defaultH: 16,
  surfaces: ['workspace'],
  component: BlastRadiusWidget,
  // BlastRadiusPanel renders its own page-level padding (`.panel` in BlastRadiusPanel.module.css)
  // since it's shared with non-widget contexts (the entity drawer); WidgetFrame's own padding on
  // top of that doubled up the spacing, so it's turned off here.
  frame: { padded: false },
  isValidConfig,
  createDefaultConfig: () => ({}),
  configForm: BlastRadiusConfigForm
};

export const blastRadiusSpec = defineComponent({
  type: BLAST_RADIUS_WIDGET_TYPE,
  category: 'visualizations',
  name: 'Blast radius',
  description: 'Entities reachable from a chosen entity, with depth and owner filters.',
  dashboardWidget: blastRadiusDashboardSpec
});
