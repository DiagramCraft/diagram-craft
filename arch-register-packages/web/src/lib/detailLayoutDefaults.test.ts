import { describe, expect, it } from 'vitest';
import { buildDefaultLayout } from './detailLayoutDefaults';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

const baseSchema: EntitySchema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Application',
  category: null,
  description: '',
  key_prefix: 'APP',
  fields: [],
  templates: [],
  groups: [],
  color: null,
  icon: null,
  entity_count: 0,
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('buildDefaultLayout', () => {
  it('still renders metadata/links/projects/diagrams (but no properties/groups) when schema is null', () => {
    const layout = buildDefaultLayout(null, []);
    expect(layout.tabs).toHaveLength(1);
    const panelIds = layout.tabs[0]!.panels.map(panel => panel.id);
    expect(panelIds).toEqual(['metadata', 'links', 'projects', 'diagrams']);
  });

  it('places ungrouped fields in a Properties panel and always includes metadata/links/projects/diagrams', () => {
    const schema: EntitySchema = {
      ...baseSchema,
      fields: [
        { id: 'f1', name: 'Field One', requirementLevel: null, type: 'text' },
        { id: 'f2', name: 'Field Two', requirementLevel: null, type: 'text' }
      ]
    };

    const layout = buildDefaultLayout(schema, []);
    expect(layout.tabs).toHaveLength(1);
    const panelIds = layout.tabs[0]!.panels.map(panel => panel.id);
    expect(panelIds).toEqual(['properties', 'metadata', 'links', 'projects', 'diagrams']);

    const propertiesPanel = layout.tabs[0]!.panels[0]!;
    expect(propertiesPanel.blocks.map(block => block.refId)).toEqual(['f1', 'f2']);
  });

  it('adds one fieldGroup panel per non-empty schema group, skipping empty groups', () => {
    const schema: EntitySchema = {
      ...baseSchema,
      fields: [
        { id: 'f1', name: 'Field One', requirementLevel: null, type: 'text', groupId: 'g1' }
      ],
      groups: [
        { id: 'g1', name: 'Group One' },
        { id: 'g2', name: 'Empty Group' }
      ]
    };

    const layout = buildDefaultLayout(schema, []);
    const groupPanels = layout.tabs[0]!.panels.filter(panel => panel.id.startsWith('group:'));
    expect(groupPanels).toHaveLength(1);
    expect(groupPanels[0]!.id).toBe('group:g1');
    expect(groupPanels[0]!.blocks).toEqual([
      { id: 'fieldGroup:g1', kind: 'fieldGroup', refId: 'g1' }
    ]);
  });

  it('omits the Properties panel when there are no ungrouped fields', () => {
    const schema: EntitySchema = {
      ...baseSchema,
      fields: [
        { id: 'f1', name: 'Field One', requirementLevel: null, type: 'text', groupId: 'g1' }
      ],
      groups: [{ id: 'g1', name: 'Group One' }]
    };

    const layout = buildDefaultLayout(schema, []);
    expect(layout.tabs[0]!.panels.some(panel => panel.id === 'properties')).toBe(false);
  });

  it('renders as a two-column tab, matching the original propsPanel/sidePanel split', () => {
    const schema: EntitySchema = {
      ...baseSchema,
      fields: [
        { id: 'f1', name: 'Field One', requirementLevel: null, type: 'text' },
        { id: 'f2', name: 'Field Two', requirementLevel: null, type: 'text', groupId: 'g1' }
      ],
      groups: [{ id: 'g1', name: 'Group One' }]
    };

    const layout = buildDefaultLayout(schema, []);
    expect(layout.tabs[0]!.columns).toBe(2);
    const panelsByColumn = (column: 1 | 2) =>
      layout.tabs[0]!.panels.filter(panel => panel.column === column).map(panel => panel.id);
    expect(panelsByColumn(1)).toEqual(['properties', 'group:g1']);
    expect(panelsByColumn(2)).toEqual(['metadata', 'links', 'projects', 'diagrams']);
  });

  it('adds a panel per applicable unbound relation schema', () => {
    const schema: EntitySchema = { ...baseSchema };
    const relationSchemas: RelationSchema[] = [
      {
        id: 'rel-1',
        workspace: 'ws-1',
        name: 'Depends On',
        fields: [],
        in: { schemaIds: 'any' },
        out: { schemaIds: [schema.id] },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      } as unknown as RelationSchema
    ];

    const layout = buildDefaultLayout(schema, relationSchemas);
    const relationPanel = layout.tabs[0]!.panels.find(panel =>
      panel.id.startsWith('unboundTypedRelation:')
    );
    expect(relationPanel).toBeDefined();
    expect(relationPanel!.blocks).toEqual([
      { id: 'unboundTypedRelation:rel-1', kind: 'unboundTypedRelation', refId: 'rel-1' }
    ]);
  });
});
