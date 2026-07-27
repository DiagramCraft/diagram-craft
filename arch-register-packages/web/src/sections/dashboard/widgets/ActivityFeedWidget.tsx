import { useNavigate } from '@tanstack/react-router';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import { formatRelativeTime } from '../../../utils/dateFormat';
import styles from './ActivityFeedWidget.module.css';

const DEFAULT_ACTIVITY_LIMIT = 15;

const getOperationLabel = (operation: string): string => {
  switch (operation) {
    case 'create':
      return 'created';
    case 'update':
      return 'updated';
    case 'delete':
      return 'deleted';
    default:
      return operation;
  }
};

const getEntityTypeLabel = (entityType: string): string => {
  switch (entityType) {
    case 'entity':
      return 'entity';
    case 'project':
      return 'project';
    case 'content_node':
      return 'diagram';
    case 'entity_schema':
      return 'schema';
    case 'workspace':
      return 'workspace';
    default:
      return entityType;
  }
};

type Props = {
  widget: Extract<DashboardWidget, { type: 'activity-feed' }>;
};

export const ActivityFeedWidget = ({ widget }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const { canViewAudit } = permissions;
  const limit = widget.limit ?? DEFAULT_ACTIVITY_LIMIT;

  const { data: recentActivity = [], isLoading: activityLoading } = useAuditLog(
    workspaceSlug,
    { limit },
    { enabled: canViewAudit }
  );

  const handleActivityClick = (entry: AuditLogEntry) => {
    switch (entry.entity_type) {
      case 'entity':
        if (entry.public_id)
          navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entry.public_id)));
        break;
      case 'project':
        if (entry.public_id) {
          navigate(
            projectDetailRoute(workspaceSlug, asProjectPublicId(entry.public_id), {
              tab: 'projects' as const,
              section: 'home' as const
            })
          );
        }
        break;
      case 'entity_schema':
        navigate({ to: '/$workspaceSlug/settings/schemas', params: { workspaceSlug } });
        break;
      // workspace and content_node don't have dedicated detail views yet
    }
  };

  if (!canViewAudit) {
    return <div className={`${styles.emptyInline} dim`}>You do not have access to activity.</div>;
  }

  return (
    <div className={styles.activityList}>
      {activityLoading ? (
        <div className={`${styles.emptyInline} dim`}>Loading activity...</div>
      ) : recentActivity.length > 0 ? (
        recentActivity.slice(0, limit).map(entry => (
          <button
            key={entry.id}
            type="button"
            className={styles.activityRow}
            onClick={() => handleActivityClick(entry)}
          >
            <span className={styles.activityWho}>
              {entry.user_display_name ?? entry.user_id ?? 'Unknown'}
            </span>
            <span className="dim"> {getOperationLabel(entry.operation)} </span>
            <span className={styles.activityTarget}>{entry.entity_name}</span>
            <span className="dim"> &middot; {getEntityTypeLabel(entry.entity_type)}</span>
            <span className={styles.activityTime}>{formatRelativeTime(entry.timestamp)}</span>
          </button>
        ))
      ) : (
        <div className={`${styles.emptyInline} dim`}>No recent activity.</div>
      )}
    </div>
  );
};
