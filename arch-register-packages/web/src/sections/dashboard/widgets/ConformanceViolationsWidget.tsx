import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { useMemo } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useConformanceChecks, useConformanceViolations } from '../../../hooks/useConformance';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { groupViolationsByEntity } from './conformanceViolationsLogic';
import styles from './ConformanceViolationsWidget.module.css';
import { TbShieldExclamation } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

export type ConformanceViolationsWidgetConfig = {
  schemaName: string;
  /** Only show violations raised by these checks (all checks when empty). */
  checkNames?: string[];
  limit: number;
};

const FETCH_LIMIT = 200;

export const ConformanceViolationsWidget = ({
  config
}: {
  config: ConformanceViolationsWidgetConfig;
}) => {
  const { workspaceSlug, permissions, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const canView = permissions.canViewSchemas;
  const schemaId = schemas.find(schema => schema.name === config.schemaName)?.id;
  const checks = useConformanceChecks(workspaceSlug, canView);
  const violations = useConformanceViolations(
    workspaceSlug,
    { schemaId, status: 'active', limit: FETCH_LIMIT, offset: 0 },
    canView && schemaId != null
  );

  const grouped = useMemo(() => {
    const names = config.checkNames ?? [];
    const checkIds =
      names.length > 0
        ? new Set((checks.data ?? []).filter(check => names.includes(check.name)).map(c => c.id))
        : undefined;
    return groupViolationsByEntity(violations.data?.items ?? [], {
      checkIds,
      limit: config.limit
    });
  }, [violations.data, checks.data, config.checkNames, config.limit]);

  if (!canView) return <EmptyState title="You do not have access to conformance." compact />;
  if (schemaId == null)
    return <EmptyState title={`Schema '${config.schemaName}' not found`} compact />;
  if (violations.isLoading || checks.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (grouped.entities.length === 0) {
    return <EmptyState title="No conformance gaps. Nothing to close." compact />;
  }

  return (
    <div className={styles.list}>
      {grouped.entities.map(entity => (
        <button
          key={entity.entityId}
          type="button"
          className={styles.row}
          onClick={() => openEntityDrawer(entity.entityId)}
        >
          <span className={styles.name}>{entity.entityName}</span>
          <span className={styles.chips}>
            {entity.messages.map(message => (
              <span
                key={message}
                className={entity.worstSeverity === 'error' ? styles.chipError : styles.chip}
              >
                {message}
              </span>
            ))}
          </span>
        </button>
      ))}
      {grouped.total > grouped.entities.length && (
        <div className={`${styles.more} dim`}>
          +{grouped.total - grouped.entities.length} more with gaps
        </div>
      )}
    </div>
  );
};

export const ConformanceViolationsHeaderActions = ({
  config
}: {
  config: ConformanceViolationsWidgetConfig;
}) => {
  const { workspaceSlug, permissions, schemas } = useWorkspaceContext();
  const schemaId = schemas.find(schema => schema.name === config.schemaName)?.id;
  const violations = useConformanceViolations(
    workspaceSlug,
    { schemaId, status: 'active', limit: 1, offset: 0 },
    permissions.canViewSchemas && schemaId != null
  );
  return <span className="dim mono">{violations.data?.total ?? ''}</span>;
};

export const ConformanceViolationsConfigForm = ({
  config,
  onChange
}: {
  config: ConformanceViolationsWidgetConfig;
  onChange: (config: ConformanceViolationsWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Max rows</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
                className={configFormStyles.labelInput}
                value={config.limit}
                onChange={event =>
                  onChange({
                    ...config,
                    limit: Math.max(1, Number(event.currentTarget.value) || 1)
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

export const CONFORMANCE_VIOLATIONS_TYPE = 'ConformanceViolations' as const;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isValidConfig = (
  config: Record<string, unknown>
): config is ConformanceViolationsWidgetConfig =>
  typeof config.schemaName === 'string' &&
  config.schemaName.length > 0 &&
  typeof config.limit === 'number' &&
  config.limit > 0 &&
  (config.checkNames === undefined || isStringArray(config.checkNames));

const _conformanceViolationsSpecData: Omit<
  DashboardWidgetSpec<ConformanceViolationsWidgetConfig>,
  'label' | 'description'
> = {
  icon: TbShieldExclamation,
  defaultW: 12,
  defaultH: 14,
  surfaces: ['workspace'],
  component: ConformanceViolationsWidget,
  headerActionsComponent: ConformanceViolationsHeaderActions,
  frame: { padded: false, showIcon: false },
  isValidConfig,
  createDefaultConfig: () => ({ schemaName: '', limit: 8 }),
  configForm: ConformanceViolationsConfigForm
};

export const conformanceViolationsSpec = defineComponent({
  type: CONFORMANCE_VIOLATIONS_TYPE,
  category: 'data-views',
  name: 'Conformance violations',
  description:
    'Entities of a schema with active conformance violations, with the failing checks, worst first.',
  dashboardWidget: _conformanceViolationsSpecData
});
