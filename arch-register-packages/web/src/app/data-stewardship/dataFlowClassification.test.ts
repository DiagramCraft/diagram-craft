import { describe, expect, it } from 'vitest';
import {
  evaluateDataFlowCoverage,
  isPersonalData,
  isRestrictedClassification,
  relationFieldValue
} from './dataFlowClassification';

describe('isRestrictedClassification', () => {
  it.each(['none', 'public', 'non-sensitive', null, undefined, 42])(
    'treats %s as not restricted',
    value => {
      expect(isRestrictedClassification(value)).toBe(false);
    }
  );

  it.each(['sensitive', 'highly-sensitive'])('treats %s as restricted', value => {
    expect(isRestrictedClassification(value)).toBe(true);
  });
});

describe('isPersonalData', () => {
  it('is the same test as isRestrictedClassification', () => {
    expect(isPersonalData('sensitive')).toBe(true);
    expect(isPersonalData('public')).toBe(false);
  });
});

describe('evaluateDataFlowCoverage', () => {
  it('flags an unsafeguarded personal-data transfer when cross-boundary and restricted', () => {
    expect(
      evaluateDataFlowCoverage({ crossBoundary: 'cross-boundary', classification: 'sensitive' })
    ).toEqual({
      crossBoundary: true,
      hasSafeguard: false,
      carriesPersonalData: true,
      unsafeguardedPersonalDataTransfer: true
    });
  });

  it('does not flag a same-region transfer even when it carries personal data', () => {
    expect(
      evaluateDataFlowCoverage({ crossBoundary: 'same-region', classification: 'sensitive' })
    ).toEqual({
      crossBoundary: false,
      hasSafeguard: false,
      carriesPersonalData: true,
      unsafeguardedPersonalDataTransfer: false
    });
  });

  it('does not flag a cross-boundary transfer that carries no personal data', () => {
    expect(
      evaluateDataFlowCoverage({ crossBoundary: 'cross-boundary', classification: 'public' })
    ).toEqual({
      crossBoundary: true,
      hasSafeguard: false,
      carriesPersonalData: false,
      unsafeguardedPersonalDataTransfer: false
    });
  });

  it('treats an incomplete residency pair as not cross-boundary', () => {
    expect(
      evaluateDataFlowCoverage({ crossBoundary: 'incomplete', classification: 'highly-sensitive' })
        .crossBoundary
    ).toBe(false);
  });
});

describe('relationFieldValue', () => {
  const SCHEMA = {
    id: 'data-flow',
    name: 'Data Flow',
    fields: [
      {
        id: 'data_classification',
        name: 'Classification',
        type: 'select',
        options: [
          { value: 'sensitive', label: 'Sensitive' },
          { value: 'public', label: 'Public' }
        ]
      }
    ]
  } as unknown as Parameters<typeof relationFieldValue>[0];

  it('resolves a select value to its option label', () => {
    expect(
      relationFieldValue(
        SCHEMA,
        { data_classification: 'sensitive' } as never,
        'data_classification'
      )
    ).toBe('Sensitive');
  });

  it('returns "—" for an empty value', () => {
    expect(
      relationFieldValue(SCHEMA, { data_classification: null } as never, 'data_classification')
    ).toBe('—');
  });

  it('falls back to the raw value when the schema has no matching option', () => {
    expect(
      relationFieldValue(
        SCHEMA,
        { data_classification: 'unknown-value' } as never,
        'data_classification'
      )
    ).toBe('unknown-value');
  });
});
