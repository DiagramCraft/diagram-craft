import { useState } from 'react';
import { TbTopologyStar3 } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { EmptyState } from '../../../components/EmptyState';
import { EntityPicker } from '../../../components/EntityPicker';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { BlastRadiusPanel } from '../../entities/components/BlastRadiusPanel';
import styles from '../WidgetConfigDialog.module.css';

export const BLAST_RADIUS_WIDGET_TYPE = 'blast-radius';

// `entityId` is the entity's public id, as chosen in the EntityPicker.
type BlastRadiusWidgetConfig = Record<string, unknown> & { label?: string; entityId?: string };

const isValidConfig = (config: Record<string, unknown>): config is BlastRadiusWidgetConfig =>
  (config.label === undefined || typeof config.label === 'string') &&
  (config.entityId === undefined || typeof config.entityId === 'string');

const titleFor = (config: BlastRadiusWidgetConfig) =>
  config.label?.trim() ? config.label.trim() : 'Blast radius';

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
    <>
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
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Title</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                placeholder="Use the widget name"
                onChange={event =>
                  commit({
                    ...config,
                    label:
                      event.currentTarget.value.trim() === ''
                        ? undefined
                        : event.currentTarget.value
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};

export const blastRadiusDashboardWidgetSpec: {
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
} = {
  type: BLAST_RADIUS_WIDGET_TYPE,
  spec: {
    icon: TbTopologyStar3,
    label: 'Blast radius',
    description: 'Entities reachable from a chosen entity, with depth and owner filters.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace'],
    component: BlastRadiusWidget,
    isValidConfig,
    createDefaultConfig: () => ({}),
    getTitle: titleFor,
    configForm: BlastRadiusConfigForm
  }
};
