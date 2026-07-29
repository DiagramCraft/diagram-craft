import type { TElement } from 'platejs';
import { TbActivity } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { ActivityFeedWidget, type ActivityFeedWidgetConfig } from './ActivityFeedWidget';
import { ActivityFeedDashboardConfigForm } from './ActivityFeedDashboardConfigForm';

export const ACTIVITY_FEED_TYPE = 'activity-feed' as const;

interface ActivityFeedSlateElement extends TElement {}

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
    defaultH: 6,
    surfaces: ['workspace'],
    component: ActivityFeedWidget,
    isValidConfig: (config): config is ActivityFeedWidgetConfig =>
      hasOptionalInteger(config, 'limit'),
    createDefaultConfig: () => ({}),
    configForm: ActivityFeedDashboardConfigForm
  }
});
