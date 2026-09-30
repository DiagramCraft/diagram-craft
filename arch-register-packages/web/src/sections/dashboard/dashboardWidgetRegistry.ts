import {
  getDashboardWidgetSpec as getBaseDashboardWidgetSpec,
  getDashboardWidgetSpecs as getBaseDashboardWidgetSpecs
} from '../markdown/mdx-components/mdxRegistry';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import { wikiPageWidgetSpec } from './widgets/WikiPageWidget';
import { apiIntegrationCatalogDashboardWidgetSpecs } from '../../app/api-integration-catalog/apiIntegrationCatalogDashboardWidgets';
import { dataStewardshipDashboardWidgetSpecs } from '../../app/data-stewardship/dataStewardshipDashboardWidgets';
import { blastRadiusDashboardWidgetSpec } from './widgets/BlastRadiusWidget';

const WIKI_PAGE_WIDGET_TYPE = 'wiki-page';

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  spec: DashboardWidgetSpec;
}> => [
  ...getBaseDashboardWidgetSpecs(),
  ...apiIntegrationCatalogDashboardWidgetSpecs,
  ...dataStewardshipDashboardWidgetSpecs,
  blastRadiusDashboardWidgetSpec,
  { type: WIKI_PAGE_WIDGET_TYPE, spec: wikiPageWidgetSpec.dashboardWidget! }
];

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  [
    ...apiIntegrationCatalogDashboardWidgetSpecs,
    ...dataStewardshipDashboardWidgetSpecs,
    blastRadiusDashboardWidgetSpec
  ].find(
    entry => entry.type === type
  )?.spec ??
  (type === WIKI_PAGE_WIDGET_TYPE
    ? wikiPageWidgetSpec.dashboardWidget
    : getBaseDashboardWidgetSpec(type));
