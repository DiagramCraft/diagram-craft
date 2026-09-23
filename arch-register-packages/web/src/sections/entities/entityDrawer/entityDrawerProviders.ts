import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import { strategyEntityDrawerProviderDefinitions } from '../../../app/strategy-model/sections/StrategyEntityDrawerProviders';
import { vendorEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/VendorEntityDrawerProviders';
import { dataStewardshipEntityDrawerProviderDefinitions } from '../../../app/data-stewardship/sections/DataStewardshipEntityDrawerProviders';
import { apiEntityDrawerProviderDefinitions } from '../../../app/api-integration-catalog/sections/ApiEntityDrawerProvider';
import { entityChangeCasesDrawerProviderDefinitions } from './EntityChangeCasesProvider';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...strategyEntityDrawerProviderDefinitions,
  ...vendorEntityDrawerProviderDefinitions,
  ...dataStewardshipEntityDrawerProviderDefinitions,
  ...entityChangeCasesDrawerProviderDefinitions,
  ...apiEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
