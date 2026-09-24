import { TbChevronDown, TbChevronUp, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  EntityDrawerCatalog,
  EntityDrawerItem,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  ItemIcon,
  ItemMenu,
  fieldItemKind,
  itemLabel,
  itemPresentation,
  rollupSourceKey,
  type AvailableChild,
  type AvailableFields,
  type MetadataSlotId,
  type ProfileSection,
  type ProfileSectionUpdater,
  type ProfileUpdater,
  type RollupSourceOption
} from './EntityDrawerEditorControls';
import {
  changeTypedRelationListField,
  getTypedRelationAttributeFields
} from './entityDrawerSettingsHelpers';
import layoutStyles from './SchemaLayoutEditor.module.css';
import styles from './EntityDrawerSettingsScreen.module.css';
import {
  moveEntityDrawerProfileEntry,
  updateEntityDrawerProfileItem
} from './entityDrawerProfileUpdates';

type EntityDrawerItemEditorProps = {
  profile: EntityDrawerProfile;
  section: ProfileSection;
  item: EntityDrawerItem;
  itemIndex: number;
  catalog: EntityDrawerCatalog;
  selectedSchema: EntitySchema;
  relationSchemas: RelationSchema[];
  availableFields: AvailableFields;
  availableSlots: EntityDrawerCatalog['slots'];
  availableChildren: AvailableChild[];
  rollupSources: RollupSourceOption[];
  updateSection: (sectionId: string, updater: ProfileSectionUpdater) => void;
  updateProfile: ProfileUpdater;
  moveItemToSection: (sectionId: string, itemIndex: number, targetId: string) => void;
};

export const EntityDrawerItemEditor = ({
  profile,
  section,
  item,
  itemIndex,
  catalog,
  selectedSchema,
  relationSchemas,
  availableFields,
  availableSlots,
  availableChildren,
  rollupSources,
  updateSection,
  updateProfile,
  moveItemToSection
}: EntityDrawerItemEditorProps) => {
  const updateItem = (updater: (current: EntityDrawerItem) => EntityDrawerItem) =>
    updateProfile(updateEntityDrawerProfileItem(profile, section.id, itemIndex, updater));

  return (
    <div className={layoutStyles.blockGroup}>
      <div className={layoutStyles.blockGroupRow}>
        <span className={layoutStyles.blockIcon}>
          <ItemIcon kind={item.kind} />
        </span>
        <TextInput
          value={itemLabel(item, catalog, selectedSchema.id)}
          onChange={value =>
            updateItem(entry =>
              entry.kind === 'placeholder'
                ? {
                    ...entry,
                    message: value && value.trim() !== '' ? value : entry.message
                  }
                : {
                    ...entry,
                    label: value && value.trim() !== '' ? value : undefined
                  }
            )
          }
          style={{ flex: 1, minWidth: 0 }}
        />
        <span className={layoutStyles.blockOrder}>
          <Button
            variant="icon-only"
            size="xs"
            disabled={itemIndex === 0}
            aria-label="Move content up"
            onClick={() =>
              updateSection(section.id, current => ({
                ...current,
                items: moveEntityDrawerProfileEntry(current.items, itemIndex, -1)
              }))
            }
          >
            <TbChevronUp size={11} />
          </Button>
          <Button
            variant="icon-only"
            size="xs"
            disabled={itemIndex === section.items.length - 1}
            aria-label="Move content down"
            onClick={() =>
              updateSection(section.id, current => ({
                ...current,
                items: moveEntityDrawerProfileEntry(current.items, itemIndex, 1)
              }))
            }
          >
            <TbChevronDown size={11} />
          </Button>
        </span>
        <ItemMenu
          sectionId={section.id}
          sections={profile.sections}
          presentation={itemPresentation(item, catalog)}
          onSetPresentation={
            itemPresentation(item, catalog) !== undefined
              ? presentation =>
                  updateItem(entry =>
                    entry.kind === 'field' || entry.kind === 'slot'
                      ? { ...entry, presentation }
                      : entry
                  )
              : undefined
          }
          showLabel={
            item.kind === 'slot' ||
            item.kind === 'rollup' ||
            item.kind === 'typed-relation-list' ||
            item.kind === 'query'
              ? item.showLabel !== false
              : undefined
          }
          onToggleShowLabel={
            item.kind === 'slot' ||
            item.kind === 'rollup' ||
            item.kind === 'typed-relation-list' ||
            item.kind === 'query'
              ? showLabel =>
                  updateItem(entry =>
                    entry.kind === 'slot' ||
                    entry.kind === 'rollup' ||
                    entry.kind === 'typed-relation-list' ||
                    entry.kind === 'query'
                      ? { ...entry, showLabel }
                      : entry
                  )
              : undefined
          }
          onMoveTo={targetId => moveItemToSection(section.id, itemIndex, targetId)}
          onRemove={() =>
            updateSection(section.id, current => ({
              ...current,
              items: current.items.filter((_, index) => index !== itemIndex)
            }))
          }
        />
      </div>
      {(item.kind === 'field' || item.kind === 'relation') && (
        <>
          <hr className={layoutStyles.blockGroupDivider} />
          <div className={styles.optionsEditor}>
            <label>
              <span>Field</span>
              <Select.Root
                value={item.fieldId}
                onChange={value => {
                  const field = availableFields.find(candidate => candidate.id === value);
                  if (!field) return;
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && (entry.kind === 'field' || entry.kind === 'relation')
                        ? {
                            ...entry,
                            kind: fieldItemKind(field.type),
                            fieldId: field.id
                          }
                        : entry
                    )
                  }));
                }}
              >
                {availableFields.map(field => (
                  <Select.Item key={field.id} value={field.id}>
                    {field.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </label>
          </div>
        </>
      )}
      {item.kind === 'metadata' && (
        <>
          <hr className={layoutStyles.blockGroupDivider} />
          <div className={styles.optionsEditor}>
            <label>
              <span>Metadata field</span>
              <Select.Root
                value={item.slot}
                onChange={value => {
                  if (!value) return;
                  const slot = value as MetadataSlotId;
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'metadata' ? { ...entry, slot } : entry
                    )
                  }));
                }}
              >
                {catalog.metadataSlots.map(slot => (
                  <Select.Item key={slot.id} value={slot.id}>
                    {slot.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </label>
          </div>
        </>
      )}
      {item.kind === 'children' && (
        <>
          <hr className={layoutStyles.blockGroupDivider} />
          <div className={styles.optionsEditor}>
            <label>
              <span>Child</span>
              <Select.Root
                value={`${item.childSchemaId}:${item.fieldId}`}
                onChange={value => {
                  const match = availableChildren.find(
                    ({ childSchema, field }) => `${childSchema.id}:${field.id}` === value
                  );
                  if (!match) return;
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'children'
                        ? {
                            ...entry,
                            childSchemaId: match.childSchema.id,
                            fieldId: match.field.id
                          }
                        : entry
                    )
                  }));
                }}
              >
                {availableChildren.map(({ childSchema, field }) => (
                  <Select.Item
                    key={`${childSchema.id}:${field.id}`}
                    value={`${childSchema.id}:${field.id}`}
                  >
                    {childSchema.name} · {field.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </label>
          </div>
        </>
      )}
      {item.kind === 'slot' &&
        (() => {
          const slotDef = catalog.slots.find(candidate => candidate.id === item.slotId);
          const optionFields = slotDef?.optionFields ?? [];
          const options = item.options ?? {};
          const setOptions = (nextOptions: Record<string, unknown>) =>
            updateSection(section.id, current => ({
              ...current,
              items: current.items.map((entry, index) =>
                index === itemIndex ? { ...entry, options: nextOptions } : entry
              )
            }));
          return (
            <>
              <hr className={layoutStyles.blockGroupDivider} />
              <div className={styles.optionsEditor}>
                <label>
                  <span>Slot</span>
                  <Select.Root
                    value={item.slotId}
                    onChange={value => {
                      const nextSlot = availableSlots.find(candidate => candidate.id === value);
                      if (!nextSlot) return;
                      updateSection(section.id, current => ({
                        ...current,
                        items: current.items.map((entry, index) =>
                          index === itemIndex && entry.kind === 'slot'
                            ? {
                                ...entry,
                                slotId: nextSlot.id,
                                ...(Object.keys(nextSlot.defaultOptions).length > 0
                                  ? { options: nextSlot.defaultOptions }
                                  : { options: undefined })
                              }
                            : entry
                        )
                      }));
                    }}
                  >
                    {availableSlots.map(slot => (
                      <Select.Item key={slot.id} value={slot.id}>
                        {slot.label}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </label>
                {optionFields.map(field => (
                  <label key={field.id} title={field.description}>
                    <span>{field.label}</span>
                    <TextInput
                      value={
                        typeof options[field.id] === 'string'
                          ? (options[field.id] as string)
                          : options[field.id] !== undefined
                            ? JSON.stringify(options[field.id])
                            : ''
                      }
                      onChange={value => setOptions({ ...options, [field.id]: value ?? '' })}
                      style={{ width: '100%' }}
                    />
                  </label>
                ))}
                <label>
                  <span>Advanced options (JSON)</span>
                  <TextArea
                    aria-label={`${itemLabel(item, catalog, selectedSchema.id)} options`}
                    value={JSON.stringify(options, null, 2)}
                    onChange={value => {
                      try {
                        setOptions(JSON.parse(value ?? '{}') as Record<string, unknown>);
                      } catch {
                        // Keep the draft unchanged until the JSON is valid.
                      }
                    }}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                </label>
              </div>
            </>
          );
        })()}
      {item.kind === 'typed-relation-list' &&
        (() => {
          const typedRelationFields = availableFields.filter(
            field => field.type === 'typedRelation'
          );
          const selectedField = selectedSchema.fields.find(field => field.id === item.fieldId);
          const attributeFields =
            selectedField?.type === 'typedRelation'
              ? getTypedRelationAttributeFields(selectedField, relationSchemas)
              : [];
          const attributes = item.attributes ?? [];
          const setAttributes = (
            nextAttributes: NonNullable<
              Extract<EntityDrawerItem, { kind: 'typed-relation-list' }>['attributes']
            >
          ) =>
            updateSection(section.id, current => ({
              ...current,
              items: current.items.map((entry, index) =>
                index === itemIndex ? { ...entry, attributes: nextAttributes } : entry
              )
            }));
          return (
            <>
              <hr className={layoutStyles.blockGroupDivider} />
              <div className={styles.optionsEditor}>
                <label>
                  <span>Field</span>
                  <Select.Root
                    value={item.fieldId}
                    onChange={value => {
                      if (!value) return;
                      updateSection(section.id, current => ({
                        ...current,
                        items: current.items.map((entry, index) =>
                          index === itemIndex && entry.kind === 'typed-relation-list'
                            ? changeTypedRelationListField(entry, value)
                            : entry
                        )
                      }));
                    }}
                  >
                    {typedRelationFields.map(field => (
                      <Select.Item key={field.id} value={field.id}>
                        {field.name}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </label>
                {attributes.map((attribute, attributeIndex) => (
                  <span key={attributeIndex} className={layoutStyles.block}>
                    <Select.Root
                      value={attribute.fieldId}
                      onChange={value =>
                        setAttributes(
                          attributes.map((entry, index) =>
                            index === attributeIndex
                              ? { ...entry, fieldId: value ?? entry.fieldId }
                              : entry
                          )
                        )
                      }
                    >
                      {!attributeFields.some(field => field.id === attribute.fieldId) && (
                        <Select.Item value={attribute.fieldId}>{attribute.fieldId}</Select.Item>
                      )}
                      {attributeFields.map(field => (
                        <Select.Item key={field.id} value={field.id}>
                          {field.name}
                        </Select.Item>
                      ))}
                    </Select.Root>
                    <TextInput
                      value={attribute.label ?? ''}
                      onChange={value =>
                        setAttributes(
                          attributes.map((entry, index) =>
                            index === attributeIndex
                              ? {
                                  ...entry,
                                  label: value && value.trim() !== '' ? value : undefined
                                }
                              : entry
                          )
                        )
                      }
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button
                      variant="icon-only"
                      size="xs"
                      aria-label="Remove attribute"
                      onClick={() =>
                        setAttributes(attributes.filter((_, index) => index !== attributeIndex))
                      }
                    >
                      <TbTrash size={11} />
                    </Button>
                  </span>
                ))}
                {attributeFields.length > 0 && (
                  <button
                    type="button"
                    className={layoutStyles.addBlockBtn}
                    onClick={() => {
                      const next = attributeFields.find(
                        field => !attributes.some(attribute => attribute.fieldId === field.id)
                      );
                      if (next) setAttributes([...attributes, { fieldId: next.id }]);
                    }}
                  >
                    <TbPlus size={10} /> Add attribute
                  </button>
                )}
              </div>
            </>
          );
        })()}
      {item.kind === 'query' && (
        <>
          <hr className={layoutStyles.blockGroupDivider} />
          <div className={styles.optionsEditor}>
            <label>
              <span>Query</span>
              <TextArea
                aria-label={`${itemLabel(item, catalog, selectedSchema.id)} query text`}
                value={item.queryText}
                onChange={value =>
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'query'
                        ? { ...entry, queryText: value ?? '' }
                        : entry
                    )
                  }))
                }
                rows={2}
                style={{ width: '100%' }}
              />
            </label>
            <label>
              <span>Presentation</span>
              <Select.Root
                value={item.presentation ?? 'list'}
                onChange={value => {
                  const presentation = (value ?? 'list') as 'chips' | 'list';
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'query'
                        ? { ...entry, presentation }
                        : entry
                    )
                  }));
                }}
              >
                <Select.Item value="list">List</Select.Item>
                <Select.Item value="chips">Chips</Select.Item>
              </Select.Root>
            </label>
            {(item.fields ?? []).map((field, fieldIndex) => (
              <span key={fieldIndex} className={layoutStyles.block}>
                <TextInput
                  value={field.fieldId}
                  onChange={value =>
                    updateSection(section.id, current => ({
                      ...current,
                      items: current.items.map((entry, index) =>
                        index === itemIndex && entry.kind === 'query'
                          ? {
                              ...entry,
                              fields: (entry.fields ?? []).map((entry2, index2) =>
                                index2 === fieldIndex ? { ...entry2, fieldId: value ?? '' } : entry2
                              )
                            }
                          : entry
                      )
                    }))
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
                <TextInput
                  value={field.label ?? ''}
                  onChange={value =>
                    updateSection(section.id, current => ({
                      ...current,
                      items: current.items.map((entry, index) =>
                        index === itemIndex && entry.kind === 'query'
                          ? {
                              ...entry,
                              fields: (entry.fields ?? []).map((entry2, index2) =>
                                index2 === fieldIndex
                                  ? {
                                      ...entry2,
                                      label: value && value.trim() !== '' ? value : undefined
                                    }
                                  : entry2
                              )
                            }
                          : entry
                      )
                    }))
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button
                  variant="icon-only"
                  size="xs"
                  aria-label="Remove field"
                  onClick={() =>
                    updateSection(section.id, current => ({
                      ...current,
                      items: current.items.map((entry, index) =>
                        index === itemIndex && entry.kind === 'query'
                          ? {
                              ...entry,
                              fields: (entry.fields ?? []).filter(
                                (_, index2) => index2 !== fieldIndex
                              )
                            }
                          : entry
                      )
                    }))
                  }
                >
                  <TbTrash size={11} />
                </Button>
              </span>
            ))}
            <button
              type="button"
              className={layoutStyles.addBlockBtn}
              onClick={() =>
                updateSection(section.id, current => ({
                  ...current,
                  items: current.items.map((entry, index) =>
                    index === itemIndex && entry.kind === 'query'
                      ? {
                          ...entry,
                          fields: [...(entry.fields ?? []), { fieldId: '' }]
                        }
                      : entry
                  )
                }))
              }
            >
              <TbPlus size={10} /> Add field
            </button>
          </div>
        </>
      )}
      {item.kind === 'rollup' && (
        <>
          <hr className={layoutStyles.blockGroupDivider} />
          <div className={styles.optionsEditor}>
            <label>
              <span>Source</span>
              <Select.Root
                value={rollupSourceKey(item.fieldId, item.sourceSchemaId, item.traversal)}
                onChange={value => {
                  const source = rollupSources.find(candidate => candidate.key === value);
                  if (!source) return;
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'rollup'
                        ? {
                            ...entry,
                            fieldId: source.fieldId,
                            sourceSchemaId: source.sourceSchemaId,
                            traversal: source.traversal,
                            format:
                              entry.aggregation === 'count'
                                ? 'number'
                                : source.fieldType === 'currency'
                                  ? 'currency'
                                  : 'decimal1'
                          }
                        : entry
                    )
                  }));
                }}
              >
                {rollupSources.map(source => (
                  <Select.Item key={source.key} value={source.key}>
                    {source.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </label>
            <label>
              <span>Aggregation</span>
              <Select.Root
                value={item.aggregation}
                onChange={value => {
                  const aggregation = (value ?? 'sum') as 'avg' | 'sum' | 'count';
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'rollup'
                        ? {
                            ...entry,
                            aggregation,
                            format:
                              aggregation === 'count'
                                ? 'number'
                                : entry.format === 'number'
                                  ? 'decimal1'
                                  : entry.format
                          }
                        : entry
                    )
                  }));
                }}
              >
                <Select.Item value="sum">Sum</Select.Item>
                <Select.Item value="avg">Average</Select.Item>
                <Select.Item value="count">Count</Select.Item>
              </Select.Root>
            </label>
            <label>
              <span>Format</span>
              <Select.Root
                value={item.format}
                disabled={item.aggregation === 'count'}
                onChange={value => {
                  const format = (value ?? 'number') as
                    | 'number'
                    | 'decimal1'
                    | 'currency'
                    | 'percent';
                  updateSection(section.id, current => ({
                    ...current,
                    items: current.items.map((entry, index) =>
                      index === itemIndex && entry.kind === 'rollup' ? { ...entry, format } : entry
                    )
                  }));
                }}
              >
                <Select.Item value="number">Number</Select.Item>
                <Select.Item value="decimal1">One decimal</Select.Item>
                <Select.Item value="currency">Currency</Select.Item>
                <Select.Item value="percent">Percent</Select.Item>
              </Select.Root>
            </label>
          </div>
        </>
      )}
    </div>
  );
};
