import { describe, expect, it } from 'vitest';
import {
  createDocumentGovernanceRegistry,
  summarizeDocumentStatusApprovals
} from './documentWorkflowOperations';

describe('document status approval summaries', () => {
  it('counts configured fields from scoped config rows', () => {
    const documentTypes = [
      {
        id: 'type-1',
        fields: [
          {
            id: 'status',
            name: 'Status',
            type: 'enum' as const,
            requirement: 'required' as const,
            isStatus: true,
            enumOptions: [{ value: 'accepted', label: 'Accepted' }],
            retired: false
          },
          {
            id: 'other',
            name: 'Other',
            type: 'enum' as const,
            requirement: 'optional' as const,
            isStatus: true,
            enumOptions: [{ value: 'open', label: 'Open' }],
            retired: false
          }
        ]
      }
    ];

    expect(
      summarizeDocumentStatusApprovals(documentTypes, [
        {
          case_subkind: 'type-1:status',
          enabled: true,
          config: { statuses: { accepted: { required: true, fallbackUserIds: ['user-1'] } } }
        },
        {
          case_subkind: 'type-1:other',
          enabled: false,
          config: { statuses: { open: { required: true, fallbackUserIds: ['user-1'] } } }
        }
      ])
    ).toEqual({ documentTypesConfigured: 1, fieldsConfigured: 1 });
  });
});

describe('createDocumentGovernanceRegistry', () => {
  it('registers the standard scheduled reminder cadence', () => {
    expect(createDocumentGovernanceRegistry().get('document.status')?.reminders).toEqual({
      approachingDays: [2],
      overdueDays: [1, 5]
    });
  });
});
