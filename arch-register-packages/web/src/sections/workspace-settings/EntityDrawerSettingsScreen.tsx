import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TbChartBar,
  TbChevronDown,
  TbChevronUp,
  TbDots,
  TbLink,
  TbPlus,
  TbPuzzle,
  TbSquare,
  TbTag,
  TbTrash
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
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

type RelationRollupOption = {
  path: MetricPathOption;
  sourceSchema: EntitySchema;
  field: EntitySchema['fields'][number];
};

const relationRollupPathKey = (path: MetricPathOption['step']): string => JSON.stringify(path);

const relationRollupOptionKey = (option: RelationRollupOption): string =>
  `${option.sourceSchema.id}:${relationRollupPathKey(option.path.step)}`;

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
          {availableGroups.map(group => (
            <div key={group.label} className={layoutStyles.menuGroup}>
              <div className={layoutStyles.menuLabel}>{group.label}</div>
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

const itemPlacementKey = (item: EntityDrawerItem): string => {
  if (item.kind === 'metadata') return `metadata:${item.slot}`;
  if (item.kind === 'slot') return `slot:${item.slotId}`;
  if (item.kind === 'children') return `children:${item.childSchemaId}:${item.fieldId}`;
  if (item.kind === 'rollup') {
    return `rollup:${item.sourceSchemaId ?? ''}:${item.fieldId}:${item.aggregation}:${JSON.stringify(item.traversal ?? null)}`;
  }
  if (item.kind === 'rollup-leaf-count') return 'rollup-leaf-count';
  if (item.kind === 'placeholder') return `placeholder:${item.message}`;
  if (item.kind === 'query') return `query:${item.queryText}`;
  return `field:${item.fieldId}`;
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
  if (kind === 'relation') return <TbLink size={11} />;
  if (kind === 'children') return <TbLink size={11} />;
  if (kind === 'slot') return <TbPuzzle size={11} />;
  if (kind === 'rollup' || kind === 'rollup-leaf-count') return <TbChartBar size={11} />;
  return <TbSquare size={11} />;
};

const EntityDrawerPreview = ({
  profile,
  catalog,
  schemaId
}: {
  profile: EntityDrawerProfile;
  catalog: EntityDrawerCatalog;
  schemaId: string;
}) => (
  <aside className={styles.previewCard} aria-label="Entity drawer preview">
    <div className={styles.previewEyebrow}>PUBLIC ID · {schemaId}</div>
    <h3 className={styles.previewTitle}>Representative entity</h3>
    {profile.header.badges.length > 0 && (
      <div className={styles.previewBadges}>
        {profile.header.badges.map((badge, index) => (
          <span key={`${badge.kind}-${index}`} className={styles.previewBadge}>
            {badge.label ?? (badge.kind === 'field' ? badge.fieldId : badge.slot)}
          </span>
        ))}
      </div>
    )}
    {profile.sections.map(section => (
      <section key={section.id} className={styles.previewSection}>
        <strong>{section.title}</strong>
        {section.items.length === 0 ? (
          <div className={styles.previewEmpty}>Empty section</div>
        ) : (
          section.items.map((item, index) => (
            <div key={`${item.kind}-${itemReference(item)}-${index}`} className={styles.previewRow}>
              <span>{itemLabel(item, catalog, schemaId)}</span>
              <span className={styles.previewValue}>
                {item.kind === 'slot'
                  ? 'Unavailable in preview'
                  : item.kind === 'placeholder'
                    ? item.message
                    : 'Example value'}
              </span>
            </div>
          ))
        )}
      </section>
    ))}
  </aside>
);

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
  const [previewState, setPreviewState] = useState<'ready' | 'loading' | 'empty' | 'unavailable'>(
    'ready'
  );
  const [customizing, setCustomizing] = useState(false);

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

  const save = () => draft && update.mutate(draft);
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
  const placedItems = new Set(
    profile.sections.flatMap(section => section.items.map(itemPlacementKey))
  );
  const placedBadges = new Set(
    profile.header.badges.map(badge =>
      badge.kind === 'metadata' ? `metadata:${badge.slot}` : `field:${badge.fieldId}`
    )
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

  const addGroupsForSection = (sectionId: string): PickerGroup[] => [
    {
      label: 'Fields',
      options: availableFields
        .filter(field => !placedItems.has(`field:${field.id}`))
        .map(field => ({
          value: `field:${field.id}`,
          label: field.name,
          pick: () =>
            addItem(sectionId, {
              kind:
                field.type === 'reference' ||
                field.type === 'containment' ||
                field.type === 'typedRelation'
                  ? 'relation'
                  : 'field',
              fieldId: field.id
            })
        }))
    },
    {
      label: 'Metadata',
      options: catalog.metadataSlots
        .filter(slot => !placedItems.has(`metadata:${slot.id}`))
        .map(slot => ({
          value: `metadata:${slot.id}`,
          label: slot.label,
          pick: () => addItem(sectionId, { kind: 'metadata', slot: slot.id })
        }))
    },
    {
      label: 'Containment children',
      options: availableChildren
        .filter(
          ({ childSchema, field }) => !placedItems.has(`children:${childSchema.id}:${field.id}`)
        )
        .map(({ childSchema, field }) => ({
          value: `children:${childSchema.id}:${field.id}`,
          label: `${childSchema.name} · ${field.name}`,
          pick: () =>
            addItem(sectionId, {
              kind: 'children',
              childSchemaId: childSchema.id,
              fieldId: field.id
            })
        }))
    },
    {
      label: 'Application content',
      options: availableSlots
        .filter(slot => !placedItems.has(`slot:${slot.id}`))
        .map(slot => ({
          value: `slot:${slot.id}`,
          label: slot.label,
          pick: () =>
            addItem(sectionId, {
              kind: 'slot',
              slotId: slot.id,
              ...(Object.keys(slot.defaultOptions).length > 0
                ? { options: slot.defaultOptions }
                : {})
            })
        }))
    },
    ...(supportsSubtreeRollup
      ? [
          {
            label: 'Roll-ups',
            options: [
              ...availableFields
                .filter(field => field.type === 'number' || field.type === 'currency')
                .filter(
                  field =>
                    !placedItems.has(
                      itemPlacementKey({
                        kind: 'rollup',
                        fieldId: field.id,
                        aggregation: field.type === 'currency' ? 'sum' : 'avg',
                        format: field.type === 'currency' ? 'currency' : 'decimal1'
                      })
                    )
                )
                .map(field => ({
                  value: `rollup:${field.id}`,
                  label: `Roll-up · ${field.name}`,
                  pick: () =>
                    addItem(sectionId, {
                      kind: 'rollup' as const,
                      fieldId: field.id,
                      aggregation: field.type === 'currency' ? ('sum' as const) : ('avg' as const),
                      format:
                        field.type === 'currency' ? ('currency' as const) : ('decimal1' as const)
                    })
                })),
              ...(!placedItems.has('rollup-leaf-count')
                ? [
                    {
                      value: 'rollup-leaf-count',
                      label: 'Leaf count',
                      pick: () => addItem(sectionId, { kind: 'rollup-leaf-count' as const })
                    }
                  ]
                : [])
            ]
          }
        ]
      : []),
    {
      label: 'Relation roll-ups',
      options: relationRollupOptions.flatMap(({ path, sourceSchema, field }) => {
        const traversal = path.step;
        const sumItem: Extract<EntityDrawerItem, { kind: 'rollup' }> = {
          kind: 'rollup',
          sourceSchemaId: sourceSchema.id,
          fieldId: field.id,
          traversal,
          aggregation: 'sum',
          format: field.type === 'currency' ? 'currency' : 'decimal1'
        };
        const countItem: Extract<EntityDrawerItem, { kind: 'rollup' }> = {
          kind: 'rollup',
          sourceSchemaId: sourceSchema.id,
          fieldId: field.id,
          traversal,
          aggregation: 'count',
          format: 'number'
        };
        return [
          {
            value: itemPlacementKey(sumItem),
            label: `${path.label} · Sum ${field.name}`,
            pick: () => addItem(sectionId, sumItem)
          },
          {
            value: itemPlacementKey(countItem),
            label: `${path.label} · Count ${sourceSchema.name}`,
            pick: () => addItem(sectionId, countItem)
          }
        ].filter(option => !placedItems.has(option.value));
      })
    }
  ];

  const badgeGroups: PickerGroup[] = [
    {
      label: 'Fields',
      options: availableFields
        .filter(field => !placedBadges.has(`field:${field.id}`))
        .map(field => ({
          value: `field:${field.id}`,
          label: field.name,
          pick: () =>
            updateProfile({
              ...profile,
              header: {
                badges: [...profile.header.badges, { kind: 'field', fieldId: field.id }]
              }
            })
        }))
    },
    {
      label: 'Metadata',
      options: catalog.metadataSlots
        .filter(slot => !placedBadges.has(`metadata:${slot.id}`))
        .map(slot => ({
          value: `metadata:${slot.id}`,
          label: slot.label,
          pick: () =>
            updateProfile({
              ...profile,
              header: {
                badges: [...profile.header.badges, { kind: 'metadata', slot: slot.id }]
              }
            })
        }))
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

      {configurationQuery.data.diagnostics.length > 0 && (
        <div className={styles.warning} role="alert">
          {configurationQuery.data.diagnostics.length} stale or invalid configuration entries are
          being omitted.
        </div>
      )}

      <div className={styles.editorGrid}>
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
                    <div key={`${badge.kind}-${index}`} className={layoutStyles.block}>
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
                      <div key={`${item.kind}-${itemReference(item)}-${itemIndex}`}>
                        <div className={layoutStyles.block}>
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
                              item.kind === 'slot' || item.kind === 'rollup'
                                ? item.showLabel !== false
                                : undefined
                            }
                            onToggleShowLabel={
                              item.kind === 'slot' || item.kind === 'rollup'
                                ? showLabel =>
                                    updateSection(section.id, current => ({
                                      ...current,
                                      items: current.items.map((entry, index) =>
                                        index === itemIndex &&
                                        (entry.kind === 'slot' || entry.kind === 'rollup')
                                          ? { ...entry, showLabel }
                                          : entry
                                      )
                                    }))
                                : undefined
                            }
                            onMoveTo={targetId =>
                              moveItemToSection(section.id, itemIndex, targetId)
                            }
                            onRemove={() =>
                              updateSection(section.id, current => ({
                                ...current,
                                items: current.items.filter((_, index) => index !== itemIndex)
                              }))
                            }
                          />
                        </div>
                        {item.kind === 'slot' && item.options && (
                          <label className={styles.optionsEditor}>
                            <span>Provider options</span>
                            <textarea
                              aria-label={`${itemLabel(item, catalog, selectedSchema.id)} options`}
                              value={JSON.stringify(item.options, null, 2)}
                              onChange={event => {
                                try {
                                  const options = JSON.parse(event.target.value) as Record<
                                    string,
                                    unknown
                                  >;
                                  updateSection(section.id, current => ({
                                    ...current,
                                    items: current.items.map((entry, index) =>
                                      index === itemIndex ? { ...entry, options } : entry
                                    )
                                  }));
                                } catch {
                                  // Keep the draft unchanged until the JSON is valid.
                                }
                              }}
                              rows={3}
                            />
                          </label>
                        )}
                        {item.kind === 'rollup' && item.traversal && (
                          <div className={styles.optionsEditor}>
                            <label>
                              <span>Relation path</span>
                              <select
                                value={
                                  relationRollupOptions.find(
                                    option =>
                                      option.sourceSchema.id === item.sourceSchemaId &&
                                      relationRollupPathKey(option.path.step) ===
                                        relationRollupPathKey(item.traversal!)
                                  )
                                    ? `${item.sourceSchemaId}:${relationRollupPathKey(item.traversal)}`
                                    : ''
                                }
                                onChange={event => {
                                  const option = relationRollupOptions.find(
                                    candidate =>
                                      relationRollupOptionKey(candidate) === event.target.value
                                  );
                                  if (!option) return;
                                  updateSection(section.id, current => ({
                                    ...current,
                                    items: current.items.map((entry, index) =>
                                      index === itemIndex && entry.kind === 'rollup'
                                        ? {
                                            ...entry,
                                            sourceSchemaId: option.sourceSchema.id,
                                            fieldId: option.field.id,
                                            traversal: option.path.step,
                                            format:
                                              entry.aggregation === 'count'
                                                ? 'number'
                                                : option.field.type === 'currency'
                                                  ? 'currency'
                                                  : 'decimal1'
                                          }
                                        : entry
                                    )
                                  }));
                                }}
                              >
                                {Array.from(
                                  new Map(
                                    relationRollupOptions.map(option => [
                                      relationRollupOptionKey(option),
                                      option
                                    ])
                                  ).values()
                                ).map(option => (
                                  <option
                                    key={relationRollupOptionKey(option)}
                                    value={relationRollupOptionKey(option)}
                                  >
                                    {option.path.label} · {option.sourceSchema.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Aggregation</span>
                              <select
                                value={item.aggregation}
                                onChange={event => {
                                  const aggregation = event.target.value as 'avg' | 'sum' | 'count';
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
                                <option value="sum">Sum</option>
                                <option value="avg">Average</option>
                                <option value="count">Count</option>
                              </select>
                            </label>
                            <label>
                              <span>Format</span>
                              <select
                                value={item.format}
                                disabled={item.aggregation === 'count'}
                                onChange={event => {
                                  const format = event.target.value as
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
                                <option value="number">Number</option>
                                <option value="decimal1">One decimal</option>
                                <option value="currency">Currency</option>
                                <option value="percent">Percent</option>
                              </select>
                            </label>
                          </div>
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

        <div className={styles.preview}>
          <div className={layoutStyles.sectionLabel}>Preview</div>
          <div className={styles.previewStates}>
            {(['ready', 'loading', 'empty', 'unavailable'] as const).map(state => (
              <button
                type="button"
                key={state}
                className={layoutStyles.tabChip}
                data-active={previewState === state}
                onClick={() => setPreviewState(state)}
              >
                <span className={layoutStyles.tabChipLabel}>{state}</span>
              </button>
            ))}
          </div>
          {previewState === 'ready' ? (
            <EntityDrawerPreview profile={profile} catalog={catalog} schemaId={selectedSchema.id} />
          ) : (
            <div className={layoutStyles.panel}>
              <strong>
                {previewState === 'loading'
                  ? 'Loading entity…'
                  : previewState === 'empty'
                    ? 'No values available'
                    : 'Content unavailable'}
              </strong>
              <p className={styles.previewEmpty}>
                The drawer keeps its structure and omits values that are unavailable to the viewer.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
