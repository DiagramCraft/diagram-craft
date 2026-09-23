import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import { strategyEntityDrawerProviderDefinitions } from '../../../app/strategy-model/sections/StrategyEntityDrawerProviders';
import { vendorEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/VendorEntityDrawerProviders';
import { apiEntityDrawerProviderDefinitions } from '../../../app/api-integration-catalog/sections/ApiEntityDrawerProvider';
import { entityChangeCasesDrawerProviderDefinitions } from './EntityChangeCasesProvider';
import { entityAssessmentsDrawerProviderDefinitions } from './EntityAssessmentsProvider';
import { entityGovernanceItemsDrawerProviderDefinitions } from './EntityGovernanceItemsProvider';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...strategyEntityDrawerProviderDefinitions,
  ...vendorEntityDrawerProviderDefinitions,
  ...entityChangeCasesDrawerProviderDefinitions,
  ...entityAssessmentsDrawerProviderDefinitions,
  ...entityGovernanceItemsDrawerProviderDefinitions,
  ...apiEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
