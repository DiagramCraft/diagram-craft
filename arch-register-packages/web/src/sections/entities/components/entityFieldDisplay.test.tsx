import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { renderEntityFieldDisplayValue, type EntityFieldDisplayDeps } from './entityFieldDisplay';

const noopDeps: EntityFieldDisplayDeps = {
  refLookup: new Map(),
  referenceOptions: {},
  typedRelationsOutgoing: [],
  typedRelationsIncoming: [],
  relationSchemas: [],
  workspaceSlug: 'ws-1',
  formatDateValue: (value: unknown) => `formatted:${String(value)}`,
  resolvePrincipalLabel: () => undefined,
  asChip: true
};

const selectField = {
  id: 'status',
  name: 'Status',
  type: 'select',
  requirementLevel: null,
  options: [{ value: 'active', label: 'Active' }]
} as unknown as EntitySchema['fields'][number];

describe('renderEntityFieldDisplayValue', () => {
  it('renders select values as a Chip when asChip is true', () => {
    const markup = renderToStaticMarkup(
      <>{renderEntityFieldDisplayValue(selectField, 'active', { ...noopDeps, asChip: true })}</>
    );
    expect(markup).toContain('Active');
    expect(markup).toContain('chip');
  });

  it('renders select values as plain text when asChip is false', () => {
    const markup = renderToStaticMarkup(
      <>{renderEntityFieldDisplayValue(selectField, 'active', { ...noopDeps, asChip: false })}</>
    );
    expect(markup).toContain('Active');
    expect(markup).not.toContain('chip');
  });

  it('formats dates through the injected formatDateValue', () => {
    const dateField = { id: 'due', name: 'Due', type: 'date', requirementLevel: null } as never;
    const markup = renderToStaticMarkup(
      <>{renderEntityFieldDisplayValue(dateField, '2024-01-01', noopDeps)}</>
    );
    expect(markup).toContain('formatted:2024-01-01');
  });

  it('renders an empty dash for null/empty values', () => {
    const textField = { id: 'name', name: 'Name', type: 'text', requirementLevel: null } as never;
    const markup = renderToStaticMarkup(<>{renderEntityFieldDisplayValue(textField, '', noopDeps)}</>);
    expect(markup).toContain('—');
  });

  it('resolves principal display via the injected resolver', () => {
    const principalField = {
      id: 'owner',
      name: 'Owner',
      type: 'principal',
      requirementLevel: null
    } as never;
    const markup = renderToStaticMarkup(
      <>
        {renderEntityFieldDisplayValue(
          principalField,
          { principal_type: 'user', principal_id: 'u1' },
          { ...noopDeps, resolvePrincipalLabel: () => 'Alice' }
        )}
      </>
    );
    expect(markup).toContain('Alice');
  });

  it('delegates reference display to the injected renderReferenceLink', () => {
    const referenceField = {
      id: 'vendor',
      name: 'Vendor',
      type: 'reference',
      schemaId: 'vendor-schema',
      requirementLevel: null
    } as never;
    const ref: EntitySummary = { _uid: 'e1', _publicId: 'V-1', _name: 'Acme', _slug: 'acme' } as never;
    const renderReferenceLink = vi.fn(({ id }) => <span>link:{id}</span>);
    const markup = renderToStaticMarkup(
      <>
        {renderEntityFieldDisplayValue(referenceField, ['e1'], {
          ...noopDeps,
          referenceOptions: { 'vendor-schema': [ref] },
          renderReferenceLink
        })}
      </>
    );
    expect(renderReferenceLink).toHaveBeenCalledWith(
      expect.objectContaining({ fieldId: 'vendor' })
    );
    expect(markup).toContain('link:');
  });

  it('delegates typed-relation display to the injected renderTypedRelationList', () => {
    const typedRelationField = {
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
      _out: { id: 'e1', name: 'Self' }
    } as never;
    const relationSchema: RelationSchema = { id: 'rel-1' } as never;
    const renderTypedRelationList = vi.fn(() => <span>relation-list</span>);
    const markup = renderToStaticMarkup(
      <>
        {renderEntityFieldDisplayValue(typedRelationField, undefined, {
          ...noopDeps,
          typedRelationsOutgoing: [record],
          relationSchemas: [relationSchema],
          renderTypedRelationList
        })}
      </>
    );
    expect(renderTypedRelationList).toHaveBeenCalled();
    expect(markup).toContain('relation-list');
  });

  it('formats multi-valued select arrays', () => {
    const multiField = {
      id: 'tags',
      name: 'Tags',
      type: 'select',
      requirementLevel: null,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' }
      ]
    } as unknown as EntitySchema['fields'][number];
    const markup = renderToStaticMarkup(
      <>{renderEntityFieldDisplayValue(multiField, ['a', 'b'], { ...noopDeps, asChip: false })}</>
    );
    expect(markup).toContain('A, B');
  });
});
