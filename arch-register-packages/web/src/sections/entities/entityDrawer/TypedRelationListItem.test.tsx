import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { TypedRelationListItem } from './TypedRelationListItem';

const field = {
  id: 'mitigating_controls',
  name: 'Mitigated by',
  type: 'typedRelation',
  relationSchemaId: 'risk-control',
  direction: 'in'
} as unknown as TypedRelationField;

const relationSchema: RelationSchema = {
  id: 'risk-control',
  workspace: 'ws-1',
  name: 'Risk Mitigation',
  category: null,
  description: '',
  in: { schemaIds: ['risk'] },
  out: { schemaIds: ['control'] },
  fields: [
    { id: 'coverage', name: 'Coverage', requirementLevel: null, type: 'number' } as never,
    { id: 'effectiveness', name: 'Effectiveness', requirementLevel: null, type: 'select' } as never
  ],
  groups: []
} as unknown as RelationSchema;

const record = (overrides: Partial<RelationRecord> = {}): RelationRecord =>
  ({
    _uid: 'relation-1',
    _schema: { id: 'risk-control', name: 'Risk Mitigation' },
    _in: { id: 'risk-1', name: 'Account Takeover' },
    _out: { id: 'control-1', name: 'MFA Enforcement' },
    coverage: 70,
    effectiveness: 'partial',
    ...overrides
  }) as unknown as RelationRecord;

const chipItem: Extract<EntityDrawerItem, { kind: 'typed-relation-list' }> = {
  kind: 'typed-relation-list',
  fieldId: 'mitigating_controls'
};

describe('TypedRelationListItem', () => {
  it('renders a chip per related entity when no attributes are configured', () => {
    const markup = renderToStaticMarkup(
      <TypedRelationListItem
        item={chipItem}
        field={field}
        label="Mitigating controls"
        typedRelationsOutgoing={[record()]}
        typedRelationsIncoming={[]}
        typedRelationsStatus={{ isLoading: false, isError: false }}
        relationSchemas={[relationSchema]}
      />
    );

    expect(markup).toContain('MFA Enforcement');
    expect(markup).not.toContain('70');
  });

  it('renders rows with formatted attribute columns when attributes are configured', () => {
    const markup = renderToStaticMarkup(
      <TypedRelationListItem
        item={{ ...chipItem, attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness' }] }}
        field={field}
        label="Mitigating controls"
        typedRelationsOutgoing={[record()]}
        typedRelationsIncoming={[]}
        typedRelationsStatus={{ isLoading: false, isError: false }}
        relationSchemas={[relationSchema]}
      />
    );

    expect(markup).toContain('MFA Enforcement');
    expect(markup).toContain('70 · partial');
  });

  it('silently skips attribute field ids that no longer exist on the relation schema', () => {
    const markup = renderToStaticMarkup(
      <TypedRelationListItem
        item={{ ...chipItem, attributes: [{ fieldId: 'coverage' }, { fieldId: 'gone' }] }}
        field={field}
        label="Mitigating controls"
        typedRelationsOutgoing={[record()]}
        typedRelationsIncoming={[]}
        typedRelationsStatus={{ isLoading: false, isError: false }}
        relationSchemas={[relationSchema]}
      />
    );

    expect(markup).toContain('70');
    expect(markup).not.toContain('gone');
  });

  it('filters relations by the field relation schema id and direction', () => {
    const markup = renderToStaticMarkup(
      <TypedRelationListItem
        item={chipItem}
        field={field}
        label="Mitigating controls"
        typedRelationsOutgoing={[
          record(),
          record({ _uid: 'other-schema', _schema: { id: 'other', name: 'Other' } })
        ]}
        typedRelationsIncoming={[
          record({ _uid: 'wrong-direction', _out: { id: 'control-2', name: 'Wrong Direction' } })
        ]}
        typedRelationsStatus={{ isLoading: false, isError: false }}
        relationSchemas={[relationSchema]}
      />
    );

    expect(markup).toContain('MFA Enforcement');
    expect(markup).not.toContain('Wrong Direction');
  });

  it('renders loading, empty, and unavailable states', () => {
    expect(
      renderToStaticMarkup(
        <TypedRelationListItem
          item={chipItem}
          field={field}
          label="Mitigating controls"
          typedRelationsOutgoing={[]}
          typedRelationsIncoming={[]}
          typedRelationsStatus={{ isLoading: true, isError: false }}
          relationSchemas={[relationSchema]}
        />
      )
    ).toContain('Loading…');

    expect(
      renderToStaticMarkup(
        <TypedRelationListItem
          item={chipItem}
          field={field}
          label="Mitigating controls"
          typedRelationsOutgoing={[]}
          typedRelationsIncoming={[]}
          typedRelationsStatus={{ isLoading: false, isError: false }}
          relationSchemas={[relationSchema]}
        />
      )
    ).toContain('No mitigating controls linked.');

    expect(
      renderToStaticMarkup(
        <TypedRelationListItem
          item={chipItem}
          field={field}
          label="Mitigating controls"
          typedRelationsOutgoing={[]}
          typedRelationsIncoming={[]}
          typedRelationsStatus={{ isLoading: false, isError: true }}
          relationSchemas={[relationSchema]}
        />
      )
    ).toContain('This content is unavailable.');
  });
});
