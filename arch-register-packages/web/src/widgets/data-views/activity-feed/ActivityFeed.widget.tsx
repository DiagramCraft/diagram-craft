/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
import { TbActivity } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  ActivityFeedDashboardConfigForm,
  ActivityFeedWidget,
  activityFeedWidgetConfigSchema
} from './ActivityFeed';

export default defineWidget({
  type: 'activity-feed',
  category: 'data-views',
  name: 'Activity feed',
  description: 'A live feed of recent audit log activity.',
  icon: TbActivity,
  component: ActivityFeedWidget,
  configForm: ActivityFeedDashboardConfigForm,
  configSchema: activityFeedWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
