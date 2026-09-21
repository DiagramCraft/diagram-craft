import { riskComplianceEntityDrawerProviderDefinitions } from '../../../app/risk-compliance/sections/ControlEntityDrawerProviders';
import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import { strategyEntityDrawerProviderDefinitions } from '../../../app/strategy-model/sections/StrategyEntityDrawerProviders';
import { vendorEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/VendorEntityDrawerProviders';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...riskComplianceEntityDrawerProviderDefinitions,
  ...strategyEntityDrawerProviderDefinitions,
  ...vendorEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
