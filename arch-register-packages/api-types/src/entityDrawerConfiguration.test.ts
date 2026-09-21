import { describe, expect, it } from 'vitest';
import {
  buildEntityDrawerCatalog,
  buildDefaultEntityDrawerConfiguration,
  buildDefaultEntityDrawerProfile,
  entityDrawerConfigurationSchema,
  mergeEntityDrawerProfiles,
  remapEntityDrawerProfiles,
  resolveEntityDrawerConfiguration
} from './entityDrawerConfiguration';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'name', name: 'Name', type: 'text' },
    { id: 'owner', name: 'Owner', type: 'principal' },
    { id: 'score', name: 'Score', type: 'number' },
    { id: 'depends_on', name: 'Depends on', type: 'reference' },
    { id: 'retired', name: 'Retired', type: 'text', archived: true }
  ],
  groups: [{ id: 'core', name: 'Core' }]
};

describe('entity drawer configuration', () => {
  it('remaps imported profiles and keeps destination profiles on merge', () => {
    const incoming = { source: buildDefaultEntityDrawerProfile(schema) };
    const remapped = remapEntityDrawerProfiles(incoming, new Map([['source', 'target']]));
    const existing = {
      target: { ...buildDefaultEntityDrawerProfile(schema), header: { badges: [] } }
    };

    expect(remapped.target).toEqual(incoming.source);
    expect(mergeEntityDrawerProfiles(existing, remapped)).toEqual(existing);
  });

  it('derives a stable default profile from schema fields and metadata', () => {
    const profile = buildDefaultEntityDrawerProfile(schema);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'name' },
        { kind: 'relation', fieldId: 'depends_on' },
        { kind: 'metadata', slot: 'publicId' }
      ])
    );
    expect(profile.sections.flatMap(section => section.items)).not.toContainEqual({
      kind: 'field',
      fieldId: 'retired'
    });
  });

  it('omits stale fields and unsupported slots while retaining defaults', () => {
    const config = entityDrawerConfigurationSchema.parse({
      version: 1,
      profiles: {
        service: {
          sections: [
            {
              id: 'custom',
              title: 'Custom',
              items: [
                { kind: 'field', fieldId: 'retired' },
                { kind: 'field', fieldId: 'missing' },
                { kind: 'slot', slotId: 'not-registered' }
              ]
            }
          ]
        }
      }
    });
    const result = resolveEntityDrawerConfiguration(config, [schema]);
    expect(result.effective.profiles.service!.sections[0]!.items).toEqual([]);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'missing_or_archived_field',
      'missing_or_archived_field',
      'unsupported_slot'
    ]);
  });

  it('fails closed for unknown versions', () => {
    const result = resolveEntityDrawerConfiguration({ version: 2, profiles: {} }, [schema]);
    expect(result.effective.profiles.service!).toBeDefined();
    expect(result.diagnostics[0]!.code).toBe('unknown_version');
  });

  it('uses defaults without diagnostics when no configuration has been stored', () => {
    const result = resolveEntityDrawerConfiguration(null, [schema]);

    expect(result.effective.profiles.service!).toEqual(buildDefaultEntityDrawerProfile(schema));
    expect(result.diagnostics).toEqual([]);
  });

  it('builds provider defaults and validates provider options', () => {
    const result = resolveEntityDrawerConfiguration(
      null,
      [schema],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } },
          view_config: {
            fields: [
              {
                fieldId: 'score',
                table: null,
                rollup: { aggregation: 'sum', format: 'number' },
                drawer: false,
                overlay: null
              }
            ]
          }
        }
      ]
    );
    const applicationSection = result.effective.profiles.service!.sections.find(
      section => section.id === 'application-content'
    );
    expect(applicationSection?.items).toEqual([
      {
        kind: 'slot',
        slotId: 'strategy.rollup',
        options: { rollups: [{ fieldId: 'score', aggregation: 'sum', format: 'number' }] }
      },
      { kind: 'slot', slotId: 'strategy.children' },
      { kind: 'slot', slotId: 'strategy.realized-by' },
      { kind: 'slot', slotId: 'strategy.linked-objectives' },
      { kind: 'slot', slotId: 'strategy.linked-initiatives' }
    ]);

    const invalid = resolveEntityDrawerConfiguration(
      {
        version: 1,
        profiles: {
          service: {
            sections: [
              {
                id: 'content',
                title: 'Content',
                items: [{ kind: 'slot', slotId: 'strategy.rollup', options: { rollups: 'bad' } }]
              }
            ]
          }
        }
      },
      [schema],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    expect(invalid.diagnostics.at(-1)?.code).toBe('invalid_slot_options');
  });

  it('only advertises provider slots for their configured schema', () => {
    const catalog = buildEntityDrawerCatalog(
      [schema, { ...schema, id: 'other', name: 'Other' }],
      [
        {
          type: 'strategy-model',
          bindings: { business_capability: { target: { kind: 'entity_schema', id: 'service' } } }
        }
      ]
    );
    expect(catalog.slots.map(slot => slot.id)).toContain('strategy.rollup');
    expect(catalog.slots.find(slot => slot.id === 'strategy.rollup')?.supportedSchemaIds).toEqual([
      'service'
    ]);
    expect(catalog.slots.map(slot => slot.id)).not.toContain('vendor.spend');
  });

  it('derives the glossary term profile from mapped capability fields', () => {
    const termSchema = {
      id: 'term',
      name: 'Term',
      fields: [
        { id: 'meaning', name: 'Meaning', type: 'longtext' },
        { id: 'aliases', name: 'Aliases', type: 'text' },
        { id: 'short_names', name: 'Short names', type: 'text' },
        { id: 'topics', name: 'Topics', type: 'reference' },
        { id: 'maturity', name: 'Maturity', type: 'select' }
      ]
    };
    const configuration = {
      type: 'business-glossary',
      bindings: {
        term: {
          target: { kind: 'entity_schema', id: 'term' },
          fieldMappings: {
            definition: 'meaning',
            synonyms: 'aliases',
            abbreviations: 'short_names',
            categories: 'topics',
            status: 'maturity'
          }
        },
        category: { target: { kind: 'entity_schema', id: 'category' } }
      }
    } as const;

    const profile = buildDefaultEntityDrawerConfiguration([termSchema], [configuration]).profiles
      .term!;

    expect(profile.header.badges).toEqual([
      { kind: 'field', fieldId: 'maturity', showLabel: false },
      { kind: 'metadata', slot: 'lifecycle' }
    ]);
    expect(profile.sections.flatMap(section => section.items)).toEqual(
      expect.arrayContaining([
        { kind: 'field', fieldId: 'meaning' },
        { kind: 'field', fieldId: 'aliases' },
        { kind: 'field', fieldId: 'short_names' },
        { kind: 'relation', fieldId: 'topics' },
        { kind: 'metadata', slot: 'owner' },
        { kind: 'slot', slotId: 'business-glossary.usage', label: 'Usage & backlinks' }
      ])
    );
    expect(profile.sections.map(section => section.id)).toEqual(['attributes', 'details']);
    expect(profile.sections.find(section => section.id === 'details')?.items).toEqual(
      expect.arrayContaining([
        { kind: 'metadata', slot: 'owner' },
        { kind: 'relation', fieldId: 'topics' },
        { kind: 'slot', slotId: 'business-glossary.usage', label: 'Usage & backlinks' }
      ])
    );
  });
});
