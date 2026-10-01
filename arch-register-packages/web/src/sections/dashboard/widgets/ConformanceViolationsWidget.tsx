import { useMemo } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useConformanceChecks, useConformanceViolations } from '../../../hooks/useConformance';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { groupViolationsByEntity } from './conformanceViolationsLogic';
import styles from './ConformanceViolationsWidget.module.css';

export type ConformanceViolationsWidgetConfig = {
  schemaName: string;
  /** Only show violations raised by these checks (all checks when empty). */
  checkNames?: string[];
  limit: number;
  label?: string;
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
