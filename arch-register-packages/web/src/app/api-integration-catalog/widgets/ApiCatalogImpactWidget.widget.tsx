import { TbAffiliate } from 'react-icons/tb';
import { defineWidget } from '../../../sections/markdown/mdx-components/defineWidget';
import { impactWidgetConfigSchema } from '../apiCatalogWidgetSupport';
import { ApiCatalogImpactHeaderActions, ApiCatalogImpactWidget } from './ApiCatalogImpactWidget';
export default defineWidget({
  type: 'api-integration-catalog-impact',
  category: 'visualizations',
  name: 'API impact',
  description:
    'Blast radius (providers, direct consumers, second order) for the API selected in the dashboard sidebar.',
  icon: TbAffiliate,
  component: ApiCatalogImpactWidget,
  configSchema: impactWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace'],
    headerActionsComponent: ApiCatalogImpactHeaderActions,
    // BlastRadiusPanel owns its padding because it is also shared with the entity drawer.
    frame: { padded: false },
    getTitle: () => 'Blast radius'
  }
});
