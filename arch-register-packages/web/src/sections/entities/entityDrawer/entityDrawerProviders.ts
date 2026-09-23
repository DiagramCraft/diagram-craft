import { vendorEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/VendorEntityDrawerProviders';
import { apiEntityDrawerProviderDefinitions } from '../../../app/api-integration-catalog/sections/ApiEntityDrawerProvider';
import { entityChangeCasesDrawerProviderDefinitions } from './EntityChangeCasesProvider';
import { entityAssessmentsDrawerProviderDefinitions } from './EntityAssessmentsProvider';
import { entityGovernanceItemsDrawerProviderDefinitions } from './EntityGovernanceItemsProvider';
import { entityUsageDrawerProviderDefinitions } from './EntityUsageProvider';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...vendorEntityDrawerProviderDefinitions,
  ...entityChangeCasesDrawerProviderDefinitions,
  ...entityAssessmentsDrawerProviderDefinitions,
  ...entityGovernanceItemsDrawerProviderDefinitions,
  ...entityUsageDrawerProviderDefinitions,
  ...apiEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
