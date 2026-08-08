import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { resolveGovernanceInitiationFields } from './governanceInitiationFields';

const db = (options = [{ value: 'normal', label: 'Normal' }]) =>
  ({
    catalog: { listEnums: vi.fn(async () => [{ id: 'urgency', options }]) }
  }) as unknown as DatabaseAdapter;

describe('governance initiation fields', () => {
  it('normalizes typed values and snapshots resolved enum options', async () => {
    const fields = await resolveGovernanceInitiationFields(
      db(),
      'workspace-1',
      {
        initiationFields: [
          { id: 'purpose', label: 'Purpose', type: 'text', requirementLevel: 'required' },
          {
            id: 'urgency',
            label: 'Urgency',
            type: 'enum',
            enumId: 'urgency',
            requirementLevel: 'optional'
          },
          {
            id: 'confidence',
            label: 'Confidence',
            type: 'rating',
            max: 4,
            requirementLevel: 'optional'
          }
        ],
        extensions: {}
      },
      { purpose: 'Reduce risk', urgency: 'normal', confidence: 3 }
    );

    expect(fields).toEqual([
      expect.objectContaining({ id: 'purpose', value: 'Reduce risk' }),
      expect.objectContaining({
        id: 'urgency',
        value: 'normal',
        options: [{ value: 'normal', label: 'Normal' }]
      }),
      expect.objectContaining({ id: 'confidence', value: 3 })
    ]);
  });

  it('rejects missing required and invalid typed values', async () => {
    await expect(
      resolveGovernanceInitiationFields(
        db(),
        'workspace-1',
        {
          initiationFields: [
            { id: 'purpose', label: 'Purpose', type: 'text', requirementLevel: 'required' }
          ],
          extensions: {}
        },
        {}
      )
    ).rejects.toThrow("Required initiation field 'purpose' is missing");

    await expect(
      resolveGovernanceInitiationFields(
        db(),
        'workspace-1',
        {
          initiationFields: [
            {
              id: 'urgency',
              label: 'Urgency',
              type: 'enum',
              enumId: 'urgency',
              requirementLevel: 'required'
            }
          ],
          extensions: {}
        },
        { urgency: 'invalid' }
      )
    ).rejects.toThrow("Initiation field 'urgency' must contain a valid option");
  });
});
