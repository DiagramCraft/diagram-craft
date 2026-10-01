import { describe, expect, it } from 'vitest';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { SEED_SCHEMA_IDS, WORKSPACE_ID } from './constants';
import { seedConformanceChecks } from './conformanceChecks';

describe('conformance check seed data', () => {
  it('provides unique, enabled Data Entity query policies with valid queries', () => {
    expect(new Set(seedConformanceChecks.map(check => check.id)).size).toBe(
      seedConformanceChecks.length
    );
    for (const check of seedConformanceChecks) {
      expect(check.workspace).toBe(WORKSPACE_ID);
      expect(check.enabled).toBe(true);
      expect(check.definition.type).toBe('query_policy');
      if (check.definition.type !== 'query_policy') continue;
      expect(entityQuerySchema.safeParse(JSON.parse(JSON.stringify(check.definition.query))).success, check.name).toBe(true);
      expect(check.definition.query.schemaId).toBe(SEED_SCHEMA_IDS.dataEntity);
    }
  });
});
