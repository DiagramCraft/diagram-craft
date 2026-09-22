import { riskComplianceEntityDrawerProviderDefinitions } from '../../../app/risk-compliance/sections/ControlEntityDrawerProviders';
import { riskEntityDrawerProviderDefinitions } from '../../../app/risk-compliance/sections/RiskEntityDrawerProviders';
import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import { strategyEntityDrawerProviderDefinitions } from '../../../app/strategy-model/sections/StrategyEntityDrawerProviders';
import { vendorContractEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/ContractEntityDrawerProviders';
import { vendorEntityDrawerProviderDefinitions } from '../../../app/vendor-management/sections/VendorEntityDrawerProviders';
import { dataStewardshipEntityDrawerProviderDefinitions } from '../../../app/data-stewardship/sections/DataStewardshipEntityDrawerProviders';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...riskComplianceEntityDrawerProviderDefinitions,
  ...riskEntityDrawerProviderDefinitions,
  ...strategyEntityDrawerProviderDefinitions,
  ...vendorContractEntityDrawerProviderDefinitions,
  ...vendorEntityDrawerProviderDefinitions,
  ...dataStewardshipEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
