/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
import { TbActivity } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { ActivityFeedWidgetConfig } from './ActivityFeedWidget';
import {
  ACTIVITY_FEED_TYPE,
  ActivityFeedDashboardConfigForm,
  ActivityFeedWidget,
  hasOptionalInteger
} from './ActivityFeedWidget';

export default defineComponent({
  type: ACTIVITY_FEED_TYPE,
  category: 'data-views',
  name: 'Activity feed',
  description: 'A live feed of recent audit log activity.',
  dashboardWidget: {
    icon: TbActivity,
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
