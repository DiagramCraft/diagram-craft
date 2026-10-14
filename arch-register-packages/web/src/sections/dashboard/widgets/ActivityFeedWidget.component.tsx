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
  ActivityFeedWidget
} from './ActivityFeedWidget';
import { hasOptionalInteger } from '../../markdown/mdx-components/configGuards';

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
    isValidConfig: (config): config is ActivityFeedWidgetConfig =>
      hasOptionalInteger(config, 'limit')
  }
});
