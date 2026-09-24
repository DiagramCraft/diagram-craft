import { entityChangeCasesDrawerProviderDefinitions } from './EntityChangeCasesProvider';
import { entityAssessmentsDrawerProviderDefinitions } from './EntityAssessmentsProvider';
import { entityGovernanceItemsDrawerProviderDefinitions } from './EntityGovernanceItemsProvider';
import { entityUsageDrawerProviderDefinitions } from './EntityUsageProvider';
import { entityBlastRadiusDrawerProviderDefinitions } from './EntityBlastRadiusProvider';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...entityChangeCasesDrawerProviderDefinitions,
  ...entityAssessmentsDrawerProviderDefinitions,
  ...entityGovernanceItemsDrawerProviderDefinitions,
  ...entityUsageDrawerProviderDefinitions,
  ...entityBlastRadiusDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
