import { TbChevronDown, TbChevronUp, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  EntityDrawerCatalog,
  EntityDrawerItem,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  AddMenu,
  fieldItemKind,
  getRelationRollupOptions,
  itemReference,
  rollupSourceKey,
  SectionMenu,
  type AvailableChild,
  type AvailableFields,
  type PickerGroup,
  type ProfileUpdater,
  type RollupSourceOption
} from './EntityDrawerEditorControls';
import { EntityDrawerItemEditor } from './EntityDrawerItemEditor';
import layoutStyles from './SchemaLayoutEditor.module.css';
import {
  moveEntityDrawerProfileEntry,
  moveEntityDrawerProfileItem,
  updateEntityDrawerProfileSection,
  updateEntityDrawerProfileSections
} from './entityDrawerProfileUpdates';

const newSection = () => ({
  id: `section-${crypto.randomUUID()}`,
  title: 'New section',
  showTitle: true,
  collapsible: true,
  items: [] as EntityDrawerItem[]
});

type EntityDrawerSectionsEditorProps = {
  profile: EntityDrawerProfile;
  catalog: EntityDrawerCatalog;
  selectedSchema: EntitySchema;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  availableFields: AvailableFields;
  availableSlots: EntityDrawerCatalog['slots'];
  availableChildren: AvailableChild[];
  canEdit: boolean;
  updateProfile: ProfileUpdater;
};

export const EntityDrawerSectionsEditor = ({
  profile,
  catalog,
  selectedSchema,
  schemas,
  relationSchemas,
  availableFields,
  availableSlots,
  availableChildren,
  canEdit,
  updateProfile
}: EntityDrawerSectionsEditorProps) => {
  const updateSection = (
    sectionId: string,
    updater: (
      section: EntityDrawerProfile['sections'][number]
    ) => EntityDrawerProfile['sections'][number]
  ) => updateProfile(updateEntityDrawerProfileSection(profile, sectionId, updater));

  const addItem = (sectionId: string, item: EntityDrawerItem) =>
    updateSection(sectionId, section => ({ ...section, items: [...section.items, item] }));

  const moveItemToSection = (sectionId: string, itemIndex: number, targetId: string) => {
    if (
      sectionId === targetId ||
      !profile.sections.find(section => section.id === sectionId)?.items[itemIndex]
    )
      return;
    updateProfile(moveEntityDrawerProfileItem(profile, sectionId, itemIndex, targetId));
  };

  const relationRollupOptions = getRelationRollupOptions(selectedSchema, schemas, relationSchemas);
  const hasLeafCount = profile.sections.some(section =>
    section.items.some(item => item.kind === 'rollup-leaf-count')
  );
  const supportsSubtreeRollup = availableFields.some(
    field => field.id === 'parent' && field.type === 'containment'
  );

  const rollupSources: RollupSourceOption[] = [
    ...(supportsSubtreeRollup
      ? availableFields
          .filter(field => field.type === 'number' || field.type === 'currency')
          .map(field => ({
            key: rollupSourceKey(field.id),
            label: field.name,
            fieldId: field.id,
            fieldType: field.type
          }))
      : []),
    ...relationRollupOptions.map(option => ({
      key: rollupSourceKey(option.field.id, option.sourceSchema.id, option.path.step),
      label: `${option.path.label} · ${option.sourceSchema.name} · ${option.field.name}`,
      sourceSchemaId: option.sourceSchema.id,
      fieldId: option.field.id,
      fieldType: option.field.type,
      traversal: option.path.step
    }))
  ];

  const addGroupsForSection = (sectionId: string): PickerGroup[] => [
    {
      label: '',
      options: [
        ...(availableFields.length > 0
          ? [
              {
                value: 'field',
                label: 'Field',
                pick: () => {
                  const field = availableFields[0]!;
                  addItem(sectionId, { kind: fieldItemKind(field.type), fieldId: field.id });
                }
              }
            ]
          : []),
        ...(availableFields.some(field => field.type === 'typedRelation')
          ? [
              {
                value: 'typed-relation-list',
                label: 'Typed relation list',
                pick: () => {
                  const field = availableFields.find(
                    candidate => candidate.type === 'typedRelation'
                  )!;
                  addItem(sectionId, { kind: 'typed-relation-list', fieldId: field.id });
                }
              }
            ]
          : []),
        ...(catalog.metadataSlots.length > 0
          ? [
              {
                value: 'metadata',
                label: 'Metadata',
                pick: () =>
                  addItem(sectionId, { kind: 'metadata', slot: catalog.metadataSlots[0]!.id })
              }
            ]
          : []),
        ...(availableChildren.length > 0
          ? [
              {
                value: 'children',
                label: 'Containment child',
                pick: () => {
                  const first = availableChildren[0]!;
                  addItem(sectionId, {
                    kind: 'children',
                    childSchemaId: first.childSchema.id,
                    fieldId: first.field.id
                  });
                }
              }
            ]
          : []),
        ...(availableSlots.length > 0
          ? [
              {
                value: 'slot',
                label: 'Application content',
                pick: () => {
                  const slot = availableSlots[0]!;
                  addItem(sectionId, {
                    kind: 'slot',
                    slotId: slot.id,
                    ...(Object.keys(slot.defaultOptions).length > 0
                      ? { options: slot.defaultOptions }
                      : {})
                  });
                }
              }
            ]
          : []),
        ...(rollupSources.length > 0
          ? [
              {
                value: 'rollup',
                label: 'Roll-up',
                pick: () => {
                  const source = rollupSources[0]!;
                  addItem(sectionId, {
                    kind: 'rollup',
                    fieldId: source.fieldId,
                    sourceSchemaId: source.sourceSchemaId,
                    traversal: source.traversal,
                    aggregation: source.fieldType === 'currency' ? 'sum' : 'avg',
                    format: source.fieldType === 'currency' ? 'currency' : 'decimal1'
                  });
                }
              }
            ]
          : []),
        ...(supportsSubtreeRollup && !hasLeafCount
          ? [
              {
                value: 'rollup-leaf-count',
                label: 'Leaf count',
                pick: () => addItem(sectionId, { kind: 'rollup-leaf-count' as const })
              }
            ]
          : []),
        {
          value: 'placeholder',
          label: 'Placeholder text',
          pick: () => addItem(sectionId, { kind: 'placeholder', message: 'Not yet available.' })
        },
        {
          value: 'query',
          label: 'Query',
          pick: () =>
            addItem(sectionId, {
              kind: 'query',
              queryText: '<-"Relation name"',
              presentation: 'list'
            })
        }
      ]
    }
  ];
  return (
    <>
      {profile.sections.length === 0 && (
        <div className={layoutStyles.columnEmpty}>No sections yet</div>
      )}
      {profile.sections.map((section, sectionIndex) => (
        <div key={section.id} className={layoutStyles.panel}>
          <div className={layoutStyles.panelHead}>
            <TextInput
              value={section.title}
              onChange={value =>
                updateSection(section.id, current => ({
                  ...current,
                  title: value ?? ''
                }))
              }
              style={{ flex: 1, minWidth: 0 }}
            />
            <span className={layoutStyles.panelActions}>
              <Button
                variant="icon-only"
                size="xs"
                disabled={sectionIndex === 0}
                aria-label="Move section up"
                onClick={() =>
                  updateProfile(
                    updateEntityDrawerProfileSections(profile, sections =>
                      moveEntityDrawerProfileEntry(sections, sectionIndex, -1)
                    )
                  )
                }
              >
                <TbChevronUp size={12} />
              </Button>
              <Button
                variant="icon-only"
                size="xs"
                disabled={sectionIndex === profile.sections.length - 1}
                aria-label="Move section down"
                onClick={() =>
                  updateProfile(
                    updateEntityDrawerProfileSections(profile, sections =>
                      moveEntityDrawerProfileEntry(sections, sectionIndex, 1)
                    )
                  )
                }
              >
                <TbChevronDown size={12} />
              </Button>
              <SectionMenu
                showTitle={section.showTitle !== false}
                layout={section.layout ?? 'rows'}
                collapsible={section.collapsible}
                onToggleShowTitle={showTitle =>
                  updateSection(section.id, current => ({
                    ...current,
                    showTitle,
                    ...(showTitle ? {} : { collapsible: false })
                  }))
                }
                onSetLayout={layout =>
                  updateSection(section.id, current => ({ ...current, layout }))
                }
                onToggleCollapsible={collapsible =>
                  updateSection(section.id, current => ({ ...current, collapsible }))
                }
                onRemove={() =>
                  updateProfile(
                    updateEntityDrawerProfileSections(profile, sections =>
                      sections.filter(entry => entry.id !== section.id)
                    )
                  )
                }
              />
            </span>
          </div>

          <div className={layoutStyles.blockList}>
            {section.items.length === 0 && (
              <div className={layoutStyles.emptyInline}>No content yet</div>
            )}
            {section.items.map((item, itemIndex) => (
              <EntityDrawerItemEditor
                key={`${itemReference(item)}-${itemIndex}`}
                profile={profile}
                section={section}
                item={item}
                itemIndex={itemIndex}
                catalog={catalog}
                selectedSchema={selectedSchema}
                relationSchemas={relationSchemas}
                availableFields={availableFields}
                availableSlots={availableSlots}
                availableChildren={availableChildren}
                rollupSources={rollupSources}
                updateSection={updateSection}
                updateProfile={updateProfile}
                moveItemToSection={moveItemToSection}
              />
            ))}
          </div>
          <AddMenu label="Add content" groups={addGroupsForSection(section.id)} />
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          className={layoutStyles.addPanelBtn}
          onClick={() =>
            updateProfile(
              updateEntityDrawerProfileSections(profile, sections => [...sections, newSection()])
            )
          }
        >
          <TbPlus size={11} /> Add section
        </button>
      )}
    </>
  );
};
