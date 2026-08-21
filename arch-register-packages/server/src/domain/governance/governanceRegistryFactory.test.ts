import { describe, expect, it } from 'vitest';
import { createApplicationGovernanceRegistry } from './governanceRegistryFactory';

describe('createApplicationGovernanceRegistry', () => {
  it('registers the same complete case-kind set used by API and job processes', () => {
    const registry = createApplicationGovernanceRegistry();

    expect([...registry.keys()]).toEqual(
      expect.arrayContaining([
        'entity.change-case',
        'entity.change-case.bulk',
        'entity.deprecation',
        'relation.change-case',
        'document.status',
        'assessment.response',
        'field-date-reminder',
        'conformance.violation'
      ])
    );
  });
});
