import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TbChartBar,
  TbChevronDown,
  TbChevronUp,
  TbDots,
  TbLink,
  TbMessage,
  TbPlus,
  TbPuzzle,
  TbSearch,
  TbSquare,
  TbTag,
  TbTrash
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  EntityDrawerBadge,
  EntityDrawerCatalog,
  EntityDrawerConfiguration,
  EntityDrawerItem,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  getMetricPathOptions,
  type MetricPathOption
} from '../entities/components/mapMetricConfig';
import {
  buildFallbackEntityDrawerProfile,
  normalizeLegacyEntityDrawerConfiguration
} from '@arch-register/api-types/entityDrawerConfiguration';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useEntityDrawerCatalog,
  useEntityDrawerConfiguration,
  useUpdateEntityDrawerConfiguration
} from '../../hooks/useWorkspaceConfig';
import layoutStyles from './SchemaLayoutEditor.module.css';
import styles from './EntityDrawerSettingsScreen.module.css';

const newSection = () => ({
  id: `section-${crypto.randomUUID()}`,
  title: 'New section',
  showTitle: true,
  collapsible: true,
  items: [] as EntityDrawerItem[]
});

const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};

const cloneProfile = (profile: EntityDrawerProfile): EntityDrawerProfile =>
  JSON.parse(JSON.stringify(profile)) as EntityDrawerProfile;

const useCloseOnOutsideClick = (open: boolean, onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, open]);
  return ref;
};

type PickerOption = { value: string; label: string; pick: () => void };
type PickerGroup = { label: string; options: PickerOption[] };

type MetadataSlotId = Extract<EntityDrawerItem, { kind: 'metadata' }>['slot'];

type RelationRollupOption = {
  path: MetricPathOption;
  sourceSchema: EntitySchema;
  field: EntitySchema['fields'][number];
};

const validateLocalEntityDrawerDraft = (configuration: EntityDrawerConfiguration): string[] =>
  Object.entries(configuration.profiles).flatMap(([schemaId, profile]) =>
    profile.sections.flatMap(section =>
      section.items.flatMap(item => {
        if (item.kind !== 'query') return [];
        return (item.fields ?? []).flatMap(field =>
          field.fieldId.trim() === ''
            ? [
                `Schema '${schemaId}', section '${section.title}': query result fields require a field id.`
              ]
            : []
        );
      })
    )
  );

const SaveErrors = ({ errors }: { errors: string[] }) =>
  errors.length > 0 ? (
    <div className={styles.error} role="alert">
      {errors.map((error, index) => (
        <div key={`${error}-${index}`}>{error}</div>
      ))}
    </div>
  ) : null;

const fieldItemKind = (type: string): 'field' | 'relation' =>
  type === 'reference' || type === 'containment' || type === 'typedRelation' ? 'relation' : 'field';

const rollupSourceKey = (
  fieldId: string,
  sourceSchemaId?: string,
  traversal?: RelationRollupOption['path']['step']
): string => `${sourceSchemaId ?? 'self'}:${fieldId}:${JSON.stringify(traversal ?? null)}`;

const getRelationRollupOptions = (
  schema: EntitySchema,
  schemas: EntitySchema[],
  relationSchemas: ReturnType<typeof useWorkspaceContext>['relationSchemas']
): RelationRollupOption[] =>
  getMetricPathOptions(schema, relationSchemas, () => 'edit', schemas).flatMap(path =>
    path.targetSchemaIds.flatMap(targetSchemaId => {
      const sourceSchema = schemas.find(candidate => candidate.id === targetSchemaId);
      if (!sourceSchema) return [];
      return sourceSchema.fields
        .filter(
          field => field.archived !== true && (field.type === 'number' || field.type === 'currency')
        )
        .map(field => ({ path, sourceSchema, field }));
    })
  );

const getTypedRelationTargetSchemas = (
  fieldId: string,
  schema: EntitySchema,
  schemas: EntitySchema[],
  relationSchemas: ReturnType<typeof useWorkspaceContext>['relationSchemas']
): EntitySchema[] => {
  const field = schema.fields.find(candidate => candidate.id === fieldId);
  if (field?.type !== 'typedRelation') return [];
  const relationSchema = relationSchemas.find(candidate => candidate.id === field.relationSchemaId);
  if (!relationSchema) return [];
  const targetEndpoint = field.direction === 'in' ? relationSchema.out : relationSchema.in;
  if (targetEndpoint.schemaIds === 'any') return schemas;
  return schemas.filter(candidate => targetEndpoint.schemaIds.includes(candidate.id));
};

const AddMenu = ({ label, groups }: { label: string; groups: PickerGroup[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutsideClick(open, () => setOpen(false));
  const availableGroups = groups.filter(group => group.options.length > 0);

  return (
    <div className={layoutStyles.addMenuWrap} ref={ref}>
      <button
        type="button"
        className={layoutStyles.addBlockBtn}
        onClick={() => setOpen(current => !current)}
      >
        <TbPlus size={10} /> {label}
      </button>
      {open && (
        <div className={layoutStyles.menu}>
          {availableGroups.length === 0 && (
            <div className={layoutStyles.menuEmpty}>Everything available is already placed</div>
          )}
          {availableGroups.map((group, groupIndex) => (
            <div key={group.label || groupIndex} className={layoutStyles.menuGroup}>
              {group.label && <div className={layoutStyles.menuLabel}>{group.label}</div>}
              {group.options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={layoutStyles.menuItem}
                  onClick={() => {
                    option.pick();
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SectionMenu = ({
  showTitle,
  layout,
  collapsible,
  onToggleShowTitle,
  onSetLayout,
  onToggleCollapsible,
  onRemove
}: {
  showTitle: boolean;
  layout: 'rows' | 'stat-grid';
  collapsible: boolean;
  onToggleShowTitle: (value: boolean) => void;
  onSetLayout: (value: 'rows' | 'stat-grid') => void;
  onToggleCollapsible: (value: boolean) => void;
  onRemove: () => void;
}) => (
  <MenuButton.Root>
    <MenuButton.Trigger variant="icon-only" size="xs" aria-label="Section options">
      <TbDots size={12} />
    </MenuButton.Trigger>
    <MenuButton.Menu align="end">
      <Menu.CheckboxItem checked={showTitle} onCheckedChange={onToggleShowTitle}>
        Show title
      </Menu.CheckboxItem>
      <Menu.CheckboxItem
        checked={collapsible}
        disabled={!showTitle}
        onCheckedChange={onToggleCollapsible}
      >
        Collapsible
      </Menu.CheckboxItem>
      <Menu.SubMenu label="Layout">
        <Menu.RadioGroup value={layout}>
          <Menu.RadioItem value="rows" onClick={() => onSetLayout('rows')}>
            Rows
          </Menu.RadioItem>
          <Menu.RadioItem value="stat-grid" onClick={() => onSetLayout('stat-grid')}>
            2-column mini-panels
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.SubMenu>
      <Menu.Separator />
      <Menu.Item type="danger" onClick={onRemove}>
        Remove section
      </Menu.Item>
    </MenuButton.Menu>
  </MenuButton.Root>
);

const ItemMenu = ({
  sectionId,
  sections,
  presentation,
  onSetPresentation,
  showLabel,
  onToggleShowLabel,
  onMoveTo,
  onRemove
}: {
  sectionId: string;
  sections: EntityDrawerProfile['sections'];
  presentation?: 'row' | 'mini-panel';
  onSetPresentation?: (value: 'row' | 'mini-panel') => void;
  showLabel?: boolean;
  onToggleShowLabel?: (value: boolean) => void;
  onMoveTo: (sectionId: string) => void;
  onRemove: () => void;
}) => (
  <MenuButton.Root>
    <MenuButton.Trigger variant="icon-only" size="xs" aria-label="Content options">
      <TbDots size={10} />
    </MenuButton.Trigger>
    <MenuButton.Menu align="end">
      {presentation !== undefined && onSetPresentation && (
        <Menu.SubMenu label="Presentation">
          <Menu.RadioGroup value={presentation}>
            <Menu.RadioItem value="row" onClick={() => onSetPresentation('row')}>
              Row
            </Menu.RadioItem>
            <Menu.RadioItem value="mini-panel" onClick={() => onSetPresentation('mini-panel')}>
              Mini-panel
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.SubMenu>
      )}
      {presentation !== undefined && showLabel !== undefined && <Menu.Separator />}
      {showLabel !== undefined && onToggleShowLabel && (
        <Menu.CheckboxItem checked={showLabel} onCheckedChange={onToggleShowLabel}>
          Show label
        </Menu.CheckboxItem>
      )}
      {showLabel !== undefined && <Menu.Separator />}
      {sections.length > 1 && (
        <Menu.SubMenu label="Move to section">
          {sections
            .filter(section => section.id !== sectionId)
            .map(section => (
              <Menu.Item key={section.id} onClick={() => onMoveTo(section.id)}>
                {section.title}
              </Menu.Item>
            ))}
        </Menu.SubMenu>
      )}
      {sections.length > 1 && <Menu.Separator />}
      <Menu.Item type="danger" onClick={onRemove}>
        Remove content
      </Menu.Item>
    </MenuButton.Menu>
  </MenuButton.Root>
);

const itemReference = (item: EntityDrawerItem): string => {
  if (item.kind === 'metadata') return item.slot;
  if (item.kind === 'slot') return item.slotId;
  if (item.kind === 'children') return `${item.childSchemaId}:${item.fieldId}`;
  if (item.kind === 'rollup-leaf-count') return item.kind;
  if (item.kind === 'placeholder') return item.message;
  if (item.kind === 'query') return item.queryText;
  return item.fieldId;
};

const itemPresentation = (
  item: EntityDrawerItem,
  catalog: EntityDrawerCatalog
): 'row' | 'mini-panel' | undefined => {
  if (item.kind !== 'field' && item.kind !== 'slot') return undefined;
  if (
    item.kind === 'slot' &&
    catalog.slots.find(slot => slot.id === item.slotId)?.fixedPresentation !== undefined
  ) {
    return undefined;
  }
  return item.presentation ?? 'row';
};

const itemLabel = (
  item: EntityDrawerItem,
  catalog: EntityDrawerCatalog,
  schemaId: string
): string => {
  if (item.kind === 'placeholder') return item.message;
  if (item.label) return item.label;
  if (item.kind === 'metadata')
    return catalog.metadataSlots.find(slot => slot.id === item.slot)?.label ?? item.slot;
  if (item.kind === 'slot')
    return catalog.slots.find(slot => slot.id === item.slotId)?.label ?? item.slotId;
  if (item.kind === 'children') {
    const childSchema = catalog.schemas.find(schema => schema.id === item.childSchemaId);
    const field = childSchema?.fields.find(candidate => candidate.id === item.fieldId);
    return `${childSchema?.name ?? item.childSchemaId} · ${field?.name ?? item.fieldId}`;
  }
  if (item.kind === 'rollup-leaf-count') return 'Leaf count';
  if (item.kind === 'rollup') {
    const field = catalog.schemas
      .find(schema => schema.id === (item.sourceSchemaId ?? schemaId))
      ?.fields.find(candidate => candidate.id === item.fieldId);
    const source = item.sourceSchemaId ? ` · ${item.sourceSchemaId}` : '';
    return `Roll-up · ${field?.name ?? item.fieldId}${source}`;
  }
  if (item.kind === 'query') return item.queryText;
  return (
    catalog.schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === item.fieldId)?.name ?? item.fieldId
  );
};

const ItemIcon = ({ kind }: { kind: EntityDrawerItem['kind'] }) => {
  if (kind === 'metadata') return <TbTag size={11} />;
  if (kind === 'relation' || kind === 'typed-relation-list') return <TbLink size={11} />;
  if (kind === 'children') return <TbLink size={11} />;
  if (kind === 'slot') return <TbPuzzle size={11} />;
  if (kind === 'rollup' || kind === 'rollup-leaf-count') return <TbChartBar size={11} />;
  if (kind === 'placeholder') return <TbMessage size={11} />;
  if (kind === 'query') return <TbSearch size={11} />;
  return <TbSquare size={11} />;
};

export const EntityDrawerEditor = ({
  schemaId,
  canEdit = true
}: {
  schemaId?: string;
  canEdit?: boolean;
}) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const selectedSchemaId = schemaId ?? schemas[0]?.id;
  const selectedSchema = schemas.find(schema => schema.id === selectedSchemaId) ?? schemas[0];
  const configurationQuery = useEntityDrawerConfiguration(workspaceSlug);
  const catalogQuery = useEntityDrawerCatalog(workspaceSlug);
  const update = useUpdateEntityDrawerConfiguration(workspaceSlug);
  const [draft, setDraft] = useState<EntityDrawerConfiguration | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  useEffect(() => {
    const stored = normalizeLegacyEntityDrawerConfiguration(
      configurationQuery.data?.stored_configuration
    );
    setDraft(
      stored && typeof stored === 'object' && 'version' in stored && stored.version === 1
        ? (JSON.parse(JSON.stringify(stored)) as EntityDrawerConfiguration)
        : { version: 1, profiles: {} }
    );
  }, [configurationQuery.data?.stored_configuration]);

  useEffect(() => {
    setCustomizing(Boolean(selectedSchemaId && draft?.profiles[selectedSchemaId]));
  }, [draft, selectedSchemaId]);

  const catalog = catalogQuery.data;
  const profile = useMemo(() => {
    if (!selectedSchemaId || !selectedSchema) return undefined;
    return (
      draft?.profiles[selectedSchemaId] ??
      configurationQuery.data?.effective_configuration.profiles[selectedSchemaId] ??
      buildFallbackEntityDrawerProfile(selectedSchema)
    );
  }, [
    configurationQuery.data?.effective_configuration.profiles,
    draft,
    selectedSchema,
    selectedSchemaId
  ]);

  if (!selectedSchema)
    return (
      <div className={styles.message}>Create an entity schema before configuring drawers.</div>
    );
  if (!catalog || !configurationQuery.data || !profile)
    return <div className={styles.message}>Loading entity drawer configuration…</div>;

  const updateProfile = (next: EntityDrawerProfile) => {
    if (!draft || !selectedSchemaId) return;
    update.reset();
    setLocalErrors([]);
    setDraft({ ...draft, profiles: { ...draft.profiles, [selectedSchemaId]: next } });
  };

  const startCustomizing = () => {
    if (!draft || !selectedSchemaId) return;
    setDraft({
      ...draft,
      profiles: { ...draft.profiles, [selectedSchemaId]: cloneProfile(profile) }
    });
    setCustomizing(true);
  };

  const disableCustomLayout = () => {
    if (!draft || !selectedSchemaId) return;
    const next = { ...draft, profiles: { ...draft.profiles } };
    delete next.profiles[selectedSchemaId];
    setDraft(next);
    setCustomizing(false);
  };

  const save = () => {
    if (!draft) return;
    const errors = validateLocalEntityDrawerDraft(draft);
    if (errors.length > 0) {
      update.reset();
      setLocalErrors(errors);
      return;
    }
    setLocalErrors([]);
    update.mutate(draft);
  };
  const saveErrors = [
    ...localErrors,
    ...(update.error instanceof Error
      ? [`Unable to save drawer configuration: ${update.error.message}`]
      : [])
  ];
  const availableFields =
    catalog.schemas
      .find(schema => schema.id === selectedSchemaId)
      ?.fields.filter(field => !field.archived) ?? [];
  const availableSlots = catalog.slots.filter(slot =>
    slot.supportedSchemaIds.includes(selectedSchema.id)
  );
  const availableChildren = catalog.schemas.flatMap(childSchema =>
    childSchema.fields
      .filter(
        field =>
          field.type === 'containment' && field.schemaId === selectedSchema.id && !field.archived
      )
      .map(field => ({ childSchema, field }))
  );
  const relationRollupOptions = getRelationRollupOptions(selectedSchema, schemas, relationSchemas);
  const hasLeafCount = profile.sections.some(section =>
    section.items.some(item => item.kind === 'rollup-leaf-count')
  );
  const stored = configurationQuery.data.stored_configuration;
  const storedProfiles =
    stored &&
    typeof stored === 'object' &&
    'version' in stored &&
    stored.version === 1 &&
    'profiles' in stored &&
    typeof stored.profiles === 'object' &&
    stored.profiles !== null
      ? stored.profiles
      : undefined;
  const defaultChangePending = Boolean(
    selectedSchemaId &&
      storedProfiles &&
      selectedSchemaId in storedProfiles &&
      !draft?.profiles[selectedSchemaId]
  );

  const updateSection = (
    sectionId: string,
    updater: (
      section: EntityDrawerProfile['sections'][number]
    ) => EntityDrawerProfile['sections'][number]
  ) =>
    updateProfile({
      ...profile,
      sections: profile.sections.map(section =>
        section.id === sectionId ? updater(section) : section
      )
    });

  const addItem = (sectionId: string, item: EntityDrawerItem) =>
    updateSection(sectionId, section => ({ ...section, items: [...section.items, item] }));

  const moveItemToSection = (sectionId: string, itemIndex: number, targetId: string) => {
    const item = profile.sections.find(section => section.id === sectionId)?.items[itemIndex];
    if (!item || sectionId === targetId) return;
    updateProfile({
      ...profile,
      sections: profile.sections.map(section =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((_, index) => index !== itemIndex) }
          : section.id === targetId
            ? { ...section, items: [...section.items, item] }
            : section
      )
    });
  };

  const supportsSubtreeRollup = availableFields.some(
    field => field.id === 'parent' && field.type === 'containment'
  );

  type RollupSourceOption = {
    key: string;
    label: string;
    sourceSchemaId?: string;
    fieldId: string;
    fieldType: string;
    traversal?: RelationRollupOption['path']['step'];
  };

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

  const badgeGroups: PickerGroup[] = [
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
                  updateProfile({
                    ...profile,
                    header: {
                      badges: [...profile.header.badges, { kind: 'field', fieldId: field.id }]
                    }
                  });
                }
              }
            ]
          : []),
        ...(catalog.metadataSlots.length > 0
          ? [
              {
                value: 'metadata',
                label: 'Metadata',
                pick: () => {
                  const slot = catalog.metadataSlots[0]!;
                  updateProfile({
                    ...profile,
                    header: {
                      badges: [...profile.header.badges, { kind: 'metadata', slot: slot.id }]
                    }
                  });
                }
              }
            ]
          : [])
      ]
    }
  ];

  if (!customizing)
    return (
      <div className={layoutStyles.off}>
        <div className={layoutStyles.offCopy}>
          <div className={layoutStyles.offTitle}>Using the default drawer layout</div>
          <div className={layoutStyles.offDesc}>
            Fields follow the schema order and field groups, followed by metadata. Application
            content appears when it is authored in a seeded, templated, or custom profile. The
            drawer stays read-only and keeps its standard responsive behavior.
          </div>
        </div>
        {canEdit && (
          <div className={styles.defaultActions}>
            {defaultChangePending && (
              <Button variant="secondary" onClick={save} disabled={update.isPending}>
                Save changes
              </Button>
            )}
            <Button variant="primary" onClick={startCustomizing}>
              Use a custom layout
            </Button>
          </div>
        )}
        <SaveErrors errors={saveErrors} />
      </div>
    );

  return (
    <>
      <label className={layoutStyles.toggle}>
        <input
          type="checkbox"
          className={layoutStyles.checkbox}
          disabled={!canEdit}
          checked
          onChange={event => {
            if (!event.target.checked) disableCustomLayout();
          }}
        />
        Use a custom layout for the entity drawer
      </label>

      <div className={styles.customHeader}>
        <div>
          <div className={layoutStyles.sectionLabel}>Entity drawer layout</div>
          <p className={styles.description}>
            Presentation only. Field-group and provider permissions are enforced when the drawer
            renders.
          </p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            Save changes
          </Button>
        )}
      </div>

      <SaveErrors errors={saveErrors} />

      {configurationQuery.data.diagnostics.length > 0 && (
        <div className={styles.warning} role="alert">
          <div>
            {configurationQuery.data.diagnostics.length} stale or invalid configuration entries are
            being omitted.
          </div>
          {configurationQuery.data.diagnostics.map((diagnostic, index) => (
            <div key={`${diagnostic.code}-${diagnostic.itemId ?? index}`}>{diagnostic.message}</div>
          ))}
        </div>
      )}

      <fieldset disabled={!canEdit} className={styles.form}>
        <div className={layoutStyles.canvas}>
          <div className={layoutStyles.column}>
            <div className={layoutStyles.panel}>
              <div className={layoutStyles.panelHead}>
                <span className={styles.panelTitle}>Header badges</span>
              </div>
              <div className={layoutStyles.blockList}>
                {profile.header.badges.length === 0 && (
                  <div className={layoutStyles.emptyInline}>No header badges</div>
                )}
                {profile.header.badges.map((badge, index) => (
                  <div key={`${badge.kind}-${index}`} className={layoutStyles.blockGroup}>
                    <div className={layoutStyles.blockGroupRow}>
                      <span className={layoutStyles.blockIcon}>
                        {badge.kind === 'metadata' ? <TbTag size={11} /> : <TbSquare size={11} />}
                      </span>
                      <TextInput
                        value={
                          badge.label ??
                          (badge.kind === 'metadata'
                            ? (catalog.metadataSlots.find(slot => slot.id === badge.slot)?.label ??
                              badge.slot)
                            : (availableFields.find(field => field.id === badge.fieldId)?.name ??
                              badge.fieldId))
                        }
                        onChange={value => {
                          const nextBadge: EntityDrawerBadge = {
                            ...badge,
                            label: value && value.trim() !== '' ? value : undefined
                          };
                          updateProfile({
                            ...profile,
                            header: {
                              badges: profile.header.badges.map((entry, badgeIndex) =>
                                badgeIndex === index ? nextBadge : entry
                              )
                            }
                          });
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <Button
                        variant="icon-only"
                        size="xs"
                        aria-label="Remove badge"
                        onClick={() =>
                          updateProfile({
                            ...profile,
                            header: {
                              badges: profile.header.badges.filter(
                                (_, badgeIndex) => badgeIndex !== index
                              )
                            }
                          })
                        }
                      >
                        <TbTrash size={11} />
                      </Button>
                    </div>
                    {badge.kind === 'field' && (
                      <>
                        <hr className={layoutStyles.blockGroupDivider} />
                        <div className={styles.optionsEditor}>
                          <label>
                            <span>Field</span>
                            <Select.Root
                              value={badge.fieldId}
                              onChange={value => {
                                const field = availableFields.find(
                                  candidate => candidate.id === value
                                );
                                if (!field) return;
                                updateProfile({
                                  ...profile,
                                  header: {
                                    badges: profile.header.badges.map((entry, badgeIndex) =>
                                      badgeIndex === index && entry.kind === 'field'
                                        ? { ...entry, fieldId: field.id }
                                        : entry
                                    )
                                  }
                                });
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
                    {badge.kind === 'metadata' && (
                      <>
                        <hr className={layoutStyles.blockGroupDivider} />
                        <div className={styles.optionsEditor}>
                          <label>
                            <span>Metadata field</span>
                            <Select.Root
                              value={badge.slot}
                              onChange={value => {
                                if (!value) return;
                                const slot = value as MetadataSlotId;
                                updateProfile({
                                  ...profile,
                                  header: {
                                    badges: profile.header.badges.map((entry, badgeIndex) =>
                                      badgeIndex === index && entry.kind === 'metadata'
                                        ? { ...entry, slot }
                                        : entry
                                    )
                                  }
                                });
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
                  </div>
                ))}
              </div>
              <AddMenu label="Add badge" groups={badgeGroups} />
            </div>

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
                        updateProfile({
                          ...profile,
                          sections: move(profile.sections, sectionIndex, -1)
                        })
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
                        updateProfile({
                          ...profile,
                          sections: move(profile.sections, sectionIndex, 1)
                        })
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
                        updateProfile({
                          ...profile,
                          sections: profile.sections.filter(entry => entry.id !== section.id)
                        })
                      }
                    />
                  </span>
                </div>

                <div className={layoutStyles.blockList}>
                  {section.items.length === 0 && (
                    <div className={layoutStyles.emptyInline}>No content yet</div>
                  )}
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={`${item.kind}-${itemReference(item)}-${itemIndex}`}
                      className={layoutStyles.blockGroup}
                    >
                      <div className={layoutStyles.blockGroupRow}>
                        <span className={layoutStyles.blockIcon}>
                          <ItemIcon kind={item.kind} />
                        </span>
                        <TextInput
                          value={itemLabel(item, catalog, selectedSchema.id)}
                          onChange={value =>
                            updateSection(section.id, current => ({
                              ...current,
                              items: current.items.map((entry, index) =>
                                index === itemIndex
                                  ? entry.kind === 'placeholder'
                                    ? {
                                        ...entry,
                                        message:
                                          value && value.trim() !== '' ? value : entry.message
                                      }
                                    : {
                                        ...entry,
                                        label: value && value.trim() !== '' ? value : undefined
                                      }
                                  : entry
                              )
                            }))
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
                                items: move(current.items, itemIndex, -1)
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
                                items: move(current.items, itemIndex, 1)
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
                                  updateSection(section.id, current => ({
                                    ...current,
                                    items: current.items.map((entry, index) =>
                                      index === itemIndex &&
                                      (entry.kind === 'field' || entry.kind === 'slot')
                                        ? { ...entry, presentation }
                                        : entry
                                    )
                                  }))
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
                                  updateSection(section.id, current => ({
                                    ...current,
                                    items: current.items.map((entry, index) =>
                                      index === itemIndex &&
                                      (entry.kind === 'slot' ||
                                        entry.kind === 'rollup' ||
                                        entry.kind === 'typed-relation-list' ||
                                        entry.kind === 'query')
                                        ? { ...entry, showLabel }
                                        : entry
                                    )
                                  }))
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
                                  const field = availableFields.find(
                                    candidate => candidate.id === value
                                  );
                                  if (!field) return;
                                  updateSection(section.id, current => ({
                                    ...current,
                                    items: current.items.map((entry, index) =>
                                      index === itemIndex &&
                                      (entry.kind === 'field' || entry.kind === 'relation')
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
                                      index === itemIndex && entry.kind === 'metadata'
                                        ? { ...entry, slot }
                                        : entry
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
                                    ({ childSchema, field }) =>
                                      `${childSchema.id}:${field.id}` === value
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
                          const slotDef = catalog.slots.find(
                            candidate => candidate.id === item.slotId
                          );
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
                                      const nextSlot = availableSlots.find(
                                        candidate => candidate.id === value
                                      );
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
                                      onChange={value =>
                                        setOptions({ ...options, [field.id]: value ?? '' })
                                      }
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
                                        setOptions(
                                          JSON.parse(value ?? '{}') as Record<string, unknown>
                                        );
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
                          const targetSchemas = getTypedRelationTargetSchemas(
                            item.fieldId,
                            selectedSchema,
                            schemas,
                            relationSchemas
                          );
                          const targetFields = targetSchemas.flatMap(targetSchema =>
                            targetSchema.fields
                              .filter(field => !field.archived)
                              .map(field => ({ targetSchema, field }))
                          );
                          const attributes = item.attributes ?? [];
                          const setAttributes = (
                            nextAttributes: NonNullable<
                              Extract<
                                EntityDrawerItem,
                                { kind: 'typed-relation-list' }
                              >['attributes']
                            >
                          ) =>
                            updateSection(section.id, current => ({
                              ...current,
                              items: current.items.map((entry, index) =>
                                index === itemIndex
                                  ? { ...entry, attributes: nextAttributes }
                                  : entry
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
                                          index === itemIndex &&
                                          entry.kind === 'typed-relation-list'
                                            ? { ...entry, fieldId: value, attributes: [] }
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
                                      {!targetFields.some(
                                        ({ field }) => field.id === attribute.fieldId
                                      ) && (
                                        <Select.Item value={attribute.fieldId}>
                                          {attribute.fieldId}
                                        </Select.Item>
                                      )}
                                      {targetFields.map(({ targetSchema, field }) => (
                                        <Select.Item
                                          key={`${targetSchema.id}:${field.id}`}
                                          value={field.id}
                                        >
                                          {targetSchemas.length > 1
                                            ? `${targetSchema.name} · ${field.name}`
                                            : field.name}
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
                                                  label:
                                                    value && value.trim() !== '' ? value : undefined
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
                                        setAttributes(
                                          attributes.filter((_, index) => index !== attributeIndex)
                                        )
                                      }
                                    >
                                      <TbTrash size={11} />
                                    </Button>
                                  </span>
                                ))}
                                {targetFields.length > 0 && (
                                  <button
                                    type="button"
                                    className={layoutStyles.addBlockBtn}
                                    onClick={() => {
                                      const next = targetFields.find(
                                        ({ field }) =>
                                          !attributes.some(
                                            attribute => attribute.fieldId === field.id
                                          )
                                      );
                                      if (next)
                                        setAttributes([...attributes, { fieldId: next.field.id }]);
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
                                                index2 === fieldIndex
                                                  ? { ...entry2, fieldId: value ?? '' }
                                                  : entry2
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
                                                      label:
                                                        value && value.trim() !== ''
                                                          ? value
                                                          : undefined
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
                                value={rollupSourceKey(
                                  item.fieldId,
                                  item.sourceSchemaId,
                                  item.traversal
                                )}
                                onChange={value => {
                                  const source = rollupSources.find(
                                    candidate => candidate.key === value
                                  );
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
                                      index === itemIndex && entry.kind === 'rollup'
                                        ? { ...entry, format }
                                        : entry
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
                  updateProfile({ ...profile, sections: [...profile.sections, newSection()] })
                }
              >
                <TbPlus size={11} /> Add section
              </button>
            )}
          </div>
        </div>
      </fieldset>
    </>
  );
};
