/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
import { TbActivity } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ACTIVITY_FEED_TYPE,
  ActivityFeedDashboardConfigForm,
  ActivityFeedWidget,
  activityFeedWidgetConfigSchema
} from './ActivityFeedWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

export default defineComponent({
  type: ACTIVITY_FEED_TYPE,
  category: 'data-views',
  name: 'Activity feed',
  description: 'A live feed of recent audit log activity.',
  icon: TbActivity,
  component: ActivityFeedWidget,
  createDefaultProps: () => ({ config: {} }),
  configForm: ActivityFeedDashboardConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(activityFeedWidgetConfigSchema)
  }
});
