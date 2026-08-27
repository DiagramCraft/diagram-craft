import { AR_COLOR_CYAN, AR_COLOR_TEAL } from '@arch-register/api-types/colors';
import type {
  SchemaDbResult,
  SharedFieldGroupDbResult,
  WorkspaceEnumDbResult
} from '../../domain/catalog/db/catalogDatabase';
import type { SupportedCurrencyDbResult } from '../../domain/workspace/db/workspaceDatabase';
import { SEED_ENUM_IDS, SEED_SCHEMA_IDS, WORKSPACE2_ID, WORKSPACE_ID, now } from './constants';
import {
  seedTemplateEnumDefinitions,
  seedTemplateFieldGroupDefinitions,
  seedTemplateSchemaDefinitions
} from './templateDefinitions';

// The default workspace catalog is a deterministic materialization of the same template
// composition used by workspace creation. The second workspace intentionally remains a small
// custom-schema fixture so tests continue to cover definitions that do not come from a template.
const secondWorkspaceEnums: WorkspaceEnumDbResult[] = [
  {
    id: SEED_ENUM_IDS.platform,
    workspace: WORKSPACE2_ID,
    name: 'Platform',
    category: 'Architecture',
    options: [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'web', label: 'Web' }
    ],
    sort_order: 0,
    created_at: now,
    updated_at: now
  }
];

export const seedEnums: WorkspaceEnumDbResult[] = [
  ...seedTemplateEnumDefinitions,
  ...secondWorkspaceEnums
];

export const seedSupportedCurrencies: SupportedCurrencyDbResult[] = [
  { workspace: WORKSPACE_ID, code: 'USD', label: 'US Dollar', sort_order: 0 },
  { workspace: WORKSPACE_ID, code: 'EUR', label: 'Euro', sort_order: 1 },
  { workspace: WORKSPACE_ID, code: 'GBP', label: 'British Pound', sort_order: 2 },
  { workspace: WORKSPACE_ID, code: 'SEK', label: 'Swedish Krona', sort_order: 3 },
  { workspace: WORKSPACE_ID, code: 'NOK', label: 'Norwegian Krone', sort_order: 4 },
  { workspace: WORKSPACE_ID, code: 'DKK', label: 'Danish Krone', sort_order: 5 },
  { workspace: WORKSPACE2_ID, code: 'USD', label: 'US Dollar', sort_order: 0 },
  { workspace: WORKSPACE2_ID, code: 'EUR', label: 'Euro', sort_order: 1 }
];

export const seedSharedFieldGroups: SharedFieldGroupDbResult[] = seedTemplateFieldGroupDefinitions;

const secondWorkspaceSchemas: SchemaDbResult[] = [
  {
    id: SEED_SCHEMA_IDS.application,
    workspace: WORKSPACE2_ID,
    name: 'Application',
    category: 'Architecture',
    description: 'A mobile or web application delivered to end users.',
    fields: [
      {
        id: 'platform',
        name: 'Platform',
        type: 'select',
        enumId: SEED_ENUM_IDS.platform
      }
    ],
    color: AR_COLOR_TEAL,
    icon: 'box',
    default_owner: null,
    key_prefix: 'APP',
    created_at: now,
    updated_at: now
  },
  {
    id: SEED_SCHEMA_IDS.service,
    workspace: WORKSPACE2_ID,
    name: 'Service',
    category: 'Architecture',
    description: 'A backend service or microservice.',
    fields: [{ id: 'technology', name: 'Technology', type: 'text' }],
    color: AR_COLOR_CYAN,
    icon: 'layers',
    default_owner: null,
    key_prefix: 'SVC',
    created_at: now,
    updated_at: now
  }
];

export const seedSchemas: SchemaDbResult[] = [
  ...seedTemplateSchemaDefinitions,
  ...secondWorkspaceSchemas
];
