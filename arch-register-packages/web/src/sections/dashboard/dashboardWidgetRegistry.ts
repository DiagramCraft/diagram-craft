import {
  getDashboardWidgetSpec as getBaseDashboardWidgetSpec,
  getDashboardWidgetSpecs as getBaseDashboardWidgetSpecs
} from '../markdown/mdx-components/mdxRegistry';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import { wikiPageWidgetSpec } from './widgets/WikiPageWidget';

const WIKI_PAGE_WIDGET_TYPE = 'wiki-page';

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  spec: DashboardWidgetSpec;
}> => [
  ...getBaseDashboardWidgetSpecs(),
  { type: WIKI_PAGE_WIDGET_TYPE, spec: wikiPageWidgetSpec.dashboardWidget! }
];

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  type === WIKI_PAGE_WIDGET_TYPE
    ? wikiPageWidgetSpec.dashboardWidget
    : getBaseDashboardWidgetSpec(type);
