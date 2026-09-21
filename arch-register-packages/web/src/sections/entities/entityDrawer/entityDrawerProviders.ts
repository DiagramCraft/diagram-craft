import { riskComplianceEntityDrawerProviderDefinitions } from '../../../app/risk-compliance/sections/ControlEntityDrawerProviders';
import { businessGlossaryEntityDrawerProviderDefinitions } from '../../../app/business-glossary/sections/GlossaryEntityDrawerProvider';
import {
  createEntityDrawerProviderRegistry,
  type EntityDrawerProviderDefinition
} from './EntityDrawerProviderRegistry';

const definitions: readonly EntityDrawerProviderDefinition[] = [
  ...businessGlossaryEntityDrawerProviderDefinitions,
  ...riskComplianceEntityDrawerProviderDefinitions
];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(definitions);
