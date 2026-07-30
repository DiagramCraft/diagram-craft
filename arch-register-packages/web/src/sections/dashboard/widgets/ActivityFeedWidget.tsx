import { useNavigate } from '@tanstack/react-router';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../../../utils/auditLabels';
import { formatRelativeTime } from '../../../utils/dateFormat';
import styles from './ActivityFeedWidget.module.css';

export type ActivityFeedWidgetConfig = { limit?: number };

const DEFAULT_ACTIVITY_LIMIT = 15;

type Props = {
  config: ActivityFeedWidgetConfig;
};

export const ActivityFeedWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const { canViewAudit } = permissions;
  const limit = config.limit ?? DEFAULT_ACTIVITY_LIMIT;

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
            <span className="dim"> {OPERATION_LABELS[entry.operation]} </span>
            <span className={styles.activityTarget}>{entry.entity_name}</span>
            <span className={styles.activityType}>
              {' '}
              &middot; {ENTITY_TYPE_LABELS[entry.entity_type]}
            </span>
            <span className={styles.activityTime}>{formatRelativeTime(entry.timestamp)}</span>
          </button>
        ))
      ) : (
        <div className={`${styles.emptyInline} dim`}>No recent activity.</div>
      )}
    </div>
  );
};
