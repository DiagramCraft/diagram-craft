import { describe, expect, it } from 'vitest';
import { caseKindLabel, humanizeCaseKind } from './governanceCaseLabels';

describe('humanizeCaseKind', () => {
  it('replaces separators and title-cases words', () => {
    expect(humanizeCaseKind('entity.change-case')).toBe('Entity Change Case');
    expect(humanizeCaseKind('field_date_reminder')).toBe('Field Date Reminder');
  });
});

describe('caseKindLabel', () => {
  it('labels a field-date-reminder case with its field name', () => {
    expect(caseKindLabel('field-date-reminder', { fieldName: 'review_date' })).toBe(
      'Date reminder · review_date'
    );
  });

  it('falls back to a generic date-reminder label without a field name', () => {
    expect(caseKindLabel('field-date-reminder', {})).toBe('Date reminder');
  });

  it('humanizes any other case kind', () => {
    expect(caseKindLabel('entity.change-case', {})).toBe('Entity Change Case');
    expect(caseKindLabel('entity.deprecation', {})).toBe('Entity Deprecation');
  });
});
