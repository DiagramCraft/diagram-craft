import { TbAffiliate } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidImpactConfig } from '../apiCatalogWidgetSupport';
import { ApiCatalogImpactHeaderActions, ApiCatalogImpactWidget } from './ApiCatalogImpactWidget';
export default defineComponent({
  type: 'api-integration-catalog-impact',
  category: 'visualizations',
  name: 'API impact',
  description:
    'Blast radius (providers, direct consumers, second order) for the API selected in the dashboard sidebar.',
  dashboardWidget: {
    icon: TbAffiliate,
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace'],
    component: ApiCatalogImpactWidget,
    headerActionsComponent: ApiCatalogImpactHeaderActions,
    // BlastRadiusPanel owns its padding because it is also shared with the entity drawer.
    frame: { padded: false },
    isValidConfig: isValidImpactConfig,
    createDefaultConfig: () => ({ entityId: '$apiEntityId' }),
    getTitle: () => 'Blast radius'
  }
});
