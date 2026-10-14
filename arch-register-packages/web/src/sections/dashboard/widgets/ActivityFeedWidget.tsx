import { useNavigate } from '@tanstack/react-router';
import type { TElement } from 'platejs';
import { TbActivity } from 'react-icons/tb';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { useAuditLog } from '../../../hooks/useAudit';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { ENTITY_TYPE_LABELS, OPERATION_LABELS } from '../../../utils/auditLabels';
import { formatRelativeTime } from '../../../utils/dateFormat';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import styles from './ActivityFeedWidget.module.css';
import formStyles from '../WidgetConfigDialog.module.css';

export type ActivityFeedWidgetConfig = { limit?: number };

const DEFAULT_ACTIVITY_LIMIT = 15;

type Props = {
  config: ActivityFeedWidgetConfig;
};

export const ActivityFeedWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
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
        if (entry.public_id) openEntityDrawer(entry.public_id);
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

type ActivityFeedConfigFormProps = {
  config: ActivityFeedWidgetConfig;
  onChange: (config: ActivityFeedWidgetConfig) => void;
};

export const ActivityFeedDashboardConfigForm = ({
                                                  config,
                                                  onChange
                                                }: ActivityFeedConfigFormProps) => (
  <DialogSection label="Options" required={false}>
    <div className={formStyles.options}>
      <label className={formStyles.optionRow}>
        <span className={formStyles.optionLabel}>Item limit</span>
        <div className={formStyles.optionControl}>
          <NumberInput
            value={config.limit ?? ''}
            min={1}
            max={50}
            step={1}
            onChange={value => onChange({ ...config, limit: value })}
            style={{ width: '80px' }}
          />
        </div>
      </label>
    </div>
  </DialogSection>
);

export const ACTIVITY_FEED_TYPE = 'activity-feed' as const;

interface ActivityFeedSlateElement extends TElement {
}

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
export const activityFeedSpec = defineMdxComponent<
  ActivityFeedSlateElement,
  { config: ActivityFeedWidgetConfig },
  'block'
>({
  component: ActivityFeedWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbActivity,
    label: 'Activity feed',
    description: 'A live feed of recent audit log activity.',
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    component: ActivityFeedWidget,
    isValidConfig: (config): config is ActivityFeedWidgetConfig =>
      hasOptionalInteger(config, 'limit'),
    createDefaultConfig: () => ({}),
    configForm: ActivityFeedDashboardConfigForm
  }
});
