import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

vi.mock('../../../components/EntityNavigationLink', () => ({
  EntityNavigationLink: ({
    publicId,
    children,
    ...props
  }: {
    publicId: string;
    children: React.ReactNode;
  }) => (
    <a href={`/entities/${publicId}`} {...props}>
      {children}
    </a>
  )
}));

vi.mock('../../../dialogs/RelationAuditLogDialog', () => ({
  RelationAuditLogDialog: () => null
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntitiesByIds: () => new Map()
}));

const { RelationRecordList, formatRelationFieldValue } = await import('./RelationRecordList');

const relationSchema: RelationSchema = {
  id: 'rel-schema-1',
  workspace: 'ws-1',
  name: 'Depends on',
  category: null,
  description: '',
  in: { schemaIds: ['schema-2'] },
  out: { schemaIds: ['schema-1'] },
  fields: [{ id: 'protocol', name: 'Protocol', requirementLevel: null, type: 'text' } as never],
  groups: [],
  color: null,
  icon: null,
  relation_count: 0,
  version: 1,
  created_at: '',
  updated_at: ''
};

const record: RelationRecord = {
  _uid: 'rel-1',
  _schema: { id: 'rel-schema-1', name: 'Depends on' },
  _in: { id: 'entity-2', name: 'Other Entity' },
  _out: { id: 'entity-1', name: 'My Entity' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '',
  _updatedAt: '',
  canView: true,
  canEdit: true,
  canDelete: true,
  canAdmin: true,
  protocol: 'https'
};

describe('RelationRecordList', () => {
  it('renders each record as a link to the other endpoint entity', () => {
    const markup = renderToStaticMarkup(
      <RelationRecordList
        records={[record]}
        direction="outgoing"
        relationSchema={relationSchema}
        workspaceId="ws-1"
      />
    );

    expect(markup).toContain('<a href="/entities/entity-1"');
    expect(markup).toContain('My Entity');
    expect(markup).toContain('Protocol: https');
  });

  it('renders nothing when there are no records', () => {
    const markup = renderToStaticMarkup(
      <RelationRecordList
        records={[]}
        direction="outgoing"
        relationSchema={relationSchema}
        workspaceId="ws-1"
      />
    );

    expect(markup).toBe('');
  });

  it('links the incoming-side endpoint when direction is incoming', () => {
    const markup = renderToStaticMarkup(
      <RelationRecordList
        records={[record]}
        direction="incoming"
        relationSchema={relationSchema}
        workspaceId="ws-1"
      />
    );

    expect(markup).toContain('<a href="/entities/entity-2"');
    expect(markup).toContain('Other Entity');
  });
});

describe('formatRelationFieldValue', () => {
  it('formats booleans as Yes/No', () => {
    const field = relationSchema.fields[0]!;
    expect(formatRelationFieldValue({ ...field, type: 'boolean' }, true)).toBe('Yes');
    expect(formatRelationFieldValue({ ...field, type: 'boolean' }, false)).toBe('No');
  });

  it('returns null for empty values', () => {
    const field = relationSchema.fields[0]!;
    expect(formatRelationFieldValue(field, '')).toBeNull();
    expect(formatRelationFieldValue(field, undefined)).toBeNull();
  });
});
