import { describe, expect, it } from 'vitest';
import {
  documentStatusApprovalConfigSchema,
  documentStatusApprovalSchema
} from './governanceCaseConfigSchemas';

describe('document status approval config schemas', () => {
  it('defaults approver lists while preserving status-specific rules', () => {
    expect(
      documentStatusApprovalConfigSchema.parse({
        statuses: {
          accepted: {
            required: true,
            requiredApprovals: 2,
            fallbackUserIds: ['user-1']
          }
        }
      })
    ).toEqual({
      statuses: {
        accepted: {
          required: true,
          requiredApprovals: 2,
          fallbackUserIds: ['user-1'],
          fallbackTeamIds: []
        }
      }
    });
  });

  it('rejects a non-positive quorum', () => {
    expect(
      documentStatusApprovalSchema.safeParse({
        required: true,
        requiredApprovals: 0,
        fallbackUserIds: [],
        fallbackTeamIds: []
      }).success
    ).toBe(false);
  });
});
