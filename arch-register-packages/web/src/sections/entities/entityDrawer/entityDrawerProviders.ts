import { riskComplianceEntityDrawerProviderDefinitions } from '../../../app/risk-compliance/sections/ControlEntityDrawerProviders';
import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import { strategyEntityDrawerProviderDefinitions } from '../../../app/strategy-model/sections/StrategyEntityDrawerProviders';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...riskComplianceEntityDrawerProviderDefinitions,
  ...strategyEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
