import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { KnownWidgetType } from './dashboardWidgetConfig';

export type WidgetSurface = 'workspace' | 'project';

export type WidgetTypeOption = {
  type: KnownWidgetType;
  label: string;
  description: string;
  defaultW: number;
  defaultH: number;
  surfaces: WidgetSurface[];
};

export const WIDGET_TYPE_OPTIONS: WidgetTypeOption[] = [
  {
    type: 'stat-metric',
    label: 'Stat metric',
    description: 'A single number, such as entity count or completeness percentage.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['workspace', 'project']
  },
  {
    type: 'saved-view-embed',
    label: 'Saved view',
    description: 'Embed one of the workspace saved views.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project']
  },
  {
    type: 'entity-table',
    label: 'Entity table',
    description: 'A filtered table of entities.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project']
  },
  {
    type: 'lifecycle-chart',
    label: 'Lifecycle chart',
    description: 'Breakdown of entities by lifecycle state.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace']
  },
  {
    type: 'activity-trend-chart',
    label: 'Activity trend chart',
    description: 'Recent activity volume over time.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace']
  },
  {
    type: 'stale-entity-report',
    label: 'Stale entity report',
    description: 'Entities that have not been updated recently.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace']
  },
  {
    type: 'activity-feed',
    label: 'Activity feed',
    description: 'A live feed of recent audit log activity.',
    defaultW: 12,
    defaultH: 6,
    surfaces: ['workspace']
  },
  {
    type: 'active-assessments',
    label: 'Active assessments',
    description: 'Up to four active assessments for the project.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['project']
  },
  {
    type: 'upcoming-milestones',
    label: 'Upcoming milestones',
    description: 'The most recently completed milestone and up to three upcoming ones.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['project']
  }
];

const nextRowY = (widgets: DashboardWidget[]): number =>
  widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

export const createDefaultWidget = (
  type: KnownWidgetType,
  widgets: DashboardWidget[],
  viewId?: string
): DashboardWidget => {
  const option = WIDGET_TYPE_OPTIONS.find(o => o.type === type)!;
  const id = `widget-${crypto.randomUUID()}`;
  const base = { id, x: 0, y: nextRowY(widgets), w: option.defaultW, h: option.defaultH };

  switch (type) {
    case 'stat-metric':
      return { ...base, type: 'stat-metric', config: { metricType: 'entity-count' } };
    case 'saved-view-embed':
      return { ...base, type: 'saved-view-embed', config: { viewId: viewId ?? '' } };
    case 'entity-table':
      return { ...base, type: 'entity-table', config: {} };
    case 'lifecycle-chart':
      return { ...base, type: 'lifecycle-chart', config: {} };
    case 'activity-trend-chart':
      return { ...base, type: 'activity-trend-chart', config: {} };
    case 'stale-entity-report':
      return { ...base, type: 'stale-entity-report', config: {} };
    case 'activity-feed':
      return { ...base, type: 'activity-feed', config: {} };
    case 'active-assessments':
      return { ...base, type: 'active-assessments', config: {} };
    case 'upcoming-milestones':
      return { ...base, type: 'upcoming-milestones', config: {} };
  }
};

export const DEFAULT_SEEDED_WIDGETS: DashboardWidget[] = [
  {
    id: 'default-entity-count',
    type: 'stat-metric',
    config: { metricType: 'entity-count' },
    x: 0,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-project-count',
    type: 'stat-metric',
    config: { metricType: 'project-count' },
    x: 3,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-diagram-count',
    type: 'stat-metric',
    config: { metricType: 'diagram-count' },
    x: 6,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-completeness-percent',
    type: 'stat-metric',
    config: { metricType: 'completeness-percent' },
    x: 9,
    y: 0,
    w: 3,
    h: 2
  },
  { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 2, w: 12, h: 6 }
];
