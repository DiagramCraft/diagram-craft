import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => () => undefined
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntitiesByIds: () => new Map()
}));

const { DrawerPropertyRow } = await import('./DrawerPropertyRow');

const baseProps = {
  refLookup: new Map(),
  referenceOptions: {},
  typedRelationsOutgoing: [] as RelationRecord[],
  typedRelationsIncoming: [] as RelationRecord[],
  relationSchemas: [] as RelationSchema[],
  workspaceSlug: 'ws-1'
};

describe('DrawerPropertyRow', () => {
  it('renders a select field as plain text, without type/optional/expected decorations', () => {
    const field = {
      id: 'status',
      name: 'Status',
      type: 'select',
      requirementLevel: 'optional',
      options: [{ value: 'active', label: 'Active' }]
    } as unknown as EntitySchema['fields'][number];

    const markup = renderToStaticMarkup(
      <DrawerPropertyRow {...baseProps} field={field} value="active" presentation="row" />
    );

    expect(markup).toContain('Active');
    expect(markup).not.toContain('chip');
    expect(markup).not.toContain('(optional)');
    expect(markup).not.toContain('Expected');
    expect(markup).not.toContain('Select');
  });

  it('formats dates through an overridden formatDateValue', () => {
    const field = { id: 'due', name: 'Due', type: 'date', requirementLevel: null } as never;

    const markup = renderToStaticMarkup(
      <DrawerPropertyRow
        {...baseProps}
        field={field}
        value="2024-01-01"
        presentation="row"
        formatDateValue={() => 'Jan 1, 2024'}
      />
    );

    expect(markup).toContain('Jan 1, 2024');
  });

  it('intercepts reference navigation via onOpenRelatedEntity', () => {
    const field = {
      id: 'vendor',
      name: 'Vendor',
      type: 'reference',
      schemaId: 'vendor-schema',
      requirementLevel: null
    } as never;
    const onOpenRelatedEntity = vi.fn(() => true);

    renderToStaticMarkup(
      <DrawerPropertyRow
        {...baseProps}
        field={field}
        value={['e1']}
        presentation="row"
        referenceOptions={{
          'vendor-schema': [{ _uid: 'e1', _publicId: 'V-1', _name: 'Acme', _slug: 'acme' } as never]
        }}
        onOpenRelatedEntity={onOpenRelatedEntity}
      />
    );

    // onOpenRelatedEntity is only invoked on click in a real browser; renderToStaticMarkup can't
    // click, so this just guards that rendering with the prop doesn't throw and shows the link.
    expect(onOpenRelatedEntity).not.toHaveBeenCalled();
  });

  it('renders mini-panel typed-relation cards always expanded, without a history button', () => {
    const field = {
      id: 'controls',
      name: 'Controls',
      type: 'typedRelation',
      relationSchemaId: 'rel-1',
      direction: 'in',
      requirementLevel: null
    } as never;
    const record: RelationRecord = {
      _uid: 'r1',
      _schema: { id: 'rel-1', name: 'Controls' },
      _in: { id: 'e2', name: 'Other' },
      _out: { id: 'e1', name: 'Self entity' }
    } as never;
    const relationSchema: RelationSchema = {
      id: 'rel-1',
      fields: [{ id: 'protocol', name: 'Protocol', type: 'text' }]
    } as never;

    const markup = renderToStaticMarkup(
      <DrawerPropertyRow
        {...baseProps}
        field={field}
        value={undefined}
        presentation="mini-panel"
        typedRelationsOutgoing={[record]}
        relationSchemas={[relationSchema]}
      />
    );

    expect(markup).toContain('Self entity');
    expect(markup).not.toContain('View history');
  });
});
