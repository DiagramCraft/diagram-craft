import { useEffect, useRef, useState } from 'react';
import {
  TbChevronDown,
  TbChevronUp,
  TbExternalLink,
  TbInfoCircle,
  TbLink,
  TbLock,
  TbPlus,
  TbSitemap,
  TbSquare,
  TbStack2,
  TbTag,
  TbTrash,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  DetailLayoutConfig,
  LayoutBlock,
  LayoutBlockKind,
  LayoutMetadataSlot,
  LayoutPanel,
  LayoutTab,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import styles from './SchemaLayoutEditor.module.css';

const METADATA_SLOT_LABELS: Record<LayoutMetadataSlot, string> = {
  name: 'Name',
  slug: 'Slug',
  description: 'Description',
  owner: 'Owner',
  lifecycle: 'Lifecycle',
  targetLifecycle: 'Target Lifecycle',
  targetLifecycleDate: 'Target Date',
  tags: 'Tags',
  publicId: 'Public ID',
  namespace: 'Namespace'
};

const ALL_METADATA_SLOTS = Object.keys(METADATA_SLOT_LABELS) as LayoutMetadataSlot[];

const KIND_ICON: Record<LayoutBlockKind, React.ComponentType<{ size?: number }>> = {
  field: TbSquare,
  fieldGroup: TbSquare,
  metadata: TbTag,
  unboundTypedRelation: TbLink,
  links: TbExternalLink,
  projects: TbStack2,
  diagrams: TbSitemap
};

const moveItem = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

type Placed = {
  fieldIds: Set<string>;
  metadataSlots: Set<LayoutMetadataSlot>;
  relationSchemaIds: Set<string>;
  hasLinks: boolean;
  hasProjects: boolean;
  hasDiagrams: boolean;
};

const computePlaced = (layout: DetailLayoutConfig): Placed => {
  const placed: Placed = {
    fieldIds: new Set(),
    metadataSlots: new Set(),
    relationSchemaIds: new Set(),
    hasLinks: false,
    hasProjects: false,
    hasDiagrams: false
  };
  for (const tab of layout.tabs) {
    for (const panel of tab.panels) {
      for (const block of panel.blocks) {
        if (block.kind === 'field' && block.refId) placed.fieldIds.add(block.refId);
        if (block.kind === 'metadata' && block.refId)
          placed.metadataSlots.add(block.refId as LayoutMetadataSlot);
        if (block.kind === 'unboundTypedRelation' && block.refId)
          placed.relationSchemaIds.add(block.refId);
        if (block.kind === 'links') placed.hasLinks = true;
        if (block.kind === 'projects') placed.hasProjects = true;
        if (block.kind === 'diagrams') placed.hasDiagrams = true;
      }
    }
  }
  return placed;
};

const blockLabel = (
  block: LayoutBlock,
  fieldsById: Map<string, SchemaField>,
  relationSchemasById: Map<string, RelationSchema>
): string => {
  if (block.kind === 'field') return fieldsById.get(block.refId ?? '')?.name ?? '(missing field)';
  if (block.kind === 'metadata')
    return METADATA_SLOT_LABELS[block.refId as LayoutMetadataSlot] ?? '(unknown slot)';
  if (block.kind === 'unboundTypedRelation')
    return relationSchemasById.get(block.refId ?? '')?.name ?? '(missing relation)';
  if (block.kind === 'links') return 'Links';
  if (block.kind === 'projects') return 'Projects';
  if (block.kind === 'diagrams') return 'Diagrams';
  return '(unknown block)';
};

type AddBlockOption = { value: string; label: string; kind: LayoutBlockKind; refId?: string };
type AddBlockOptionGroups = {
  fields: AddBlockOption[];
  metadata: AddBlockOption[];
  relations: AddBlockOption[];
  other: AddBlockOption[];
};

const Segmented = ({
  options,
  value,
  disabled,
  onChange
}: {
  options: Array<{ value: 1 | 2; label: string }>;
  value: 1 | 2;
  disabled?: boolean;
  onChange: (value: 1 | 2) => void;
}) => (
  <div className={styles.segmented}>
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        data-active={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const useCloseOnOutsideClick = (open: boolean, onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
};

const AddBlockMenu = ({
  options,
  onAdd
}: {
  options: AddBlockOptionGroups;
  onAdd: (kind: LayoutBlockKind, refId?: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutsideClick(open, () => setOpen(false));
  const nothing =
    !options.fields.length &&
    !options.metadata.length &&
    !options.relations.length &&
    !options.other.length;

  const pick = (option: AddBlockOption) => {
    onAdd(option.kind, option.refId);
    setOpen(false);
  };

  return (
    <div className={styles.addMenuWrap} ref={ref}>
      <button type="button" className={styles.addBlockBtn} onClick={() => setOpen(o => !o)}>
        <TbPlus size={10} /> Add block
      </button>
      {open && (
        <div className={styles.menu}>
          {nothing && (
            <div className={styles.menuEmpty}>Everything available is already placed</div>
          )}
          {!!options.fields.length && (
            <div className={styles.menuGroup}>
              <div className={styles.menuLabel}>Fields</div>
              {options.fields.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {!!options.metadata.length && (
            <div className={styles.menuGroup}>
              <div className={styles.menuLabel}>Metadata</div>
              {options.metadata.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {!!options.relations.length && (
            <div className={styles.menuGroup}>
              <div className={styles.menuLabel}>Relations</div>
              {options.relations.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {!!options.other.length && (
            <div className={styles.menuGroup}>
              <div className={styles.menuLabel}>Other</div>
              {options.other.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AddPanelMenu = ({
  unplacedGroups,
  onAdd
}: {
  unplacedGroups: SchemaGroup[];
  onAdd: (groupId: string | undefined) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutsideClick(open, () => setOpen(false));

  return (
    <div className={styles.addMenuWrap} ref={ref}>
      <button type="button" className={styles.addPanelBtn} onClick={() => setOpen(o => !o)}>
        <TbPlus size={11} /> Add panel
      </button>
      {open && (
        <div className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onAdd(undefined);
              setOpen(false);
            }}
          >
            Free-form panel
          </button>
          {unplacedGroups.length > 0 && (
            <div className={styles.menuGroup}>
              <div className={styles.menuLabel}>Link to field group</div>
              {unplacedGroups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    onAdd(group.id);
                    setOpen(false);
                  }}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SchemaLayoutEditor = ({
  layout,
  fields,
  groups,
  relationSchemas,
  canEdit,
  onChange
}: {
  layout: DetailLayoutConfig;
  fields: SchemaField[];
  groups: SchemaGroup[];
  relationSchemas: RelationSchema[];
  canEdit: boolean;
  onChange: (layout: DetailLayoutConfig) => void;
}) => {
  const [activeTabId, setActiveTabId] = useState<string | undefined>(layout.tabs[0]?.id);
  const activeTab = layout.tabs.find(tab => tab.id === activeTabId) ?? layout.tabs[0];

  const fieldsById = new Map(fields.map(field => [field.id, field]));
  const relationSchemasById = new Map(relationSchemas.map(rs => [rs.id, rs]));
  const placed = computePlaced(layout);
  const linkedGroupIds = new Set(
    layout.tabs.flatMap(tab =>
      tab.panels.flatMap(panel =>
        panel.blocks.length === 1 && panel.blocks[0]!.kind === 'fieldGroup'
          ? [panel.blocks[0]!.refId]
          : []
      )
    )
  );
  const unplacedGroups = groups.filter(group => !linkedGroupIds.has(group.id));

  const updateTabs = (updater: (tabs: LayoutTab[]) => LayoutTab[]) =>
    onChange({ ...layout, tabs: updater(layout.tabs) });

  const updateTab = (tabId: string, updater: (tab: LayoutTab) => LayoutTab) =>
    updateTabs(tabs => tabs.map(tab => (tab.id === tabId ? updater(tab) : tab)));

  const updatePanel = (
    tabId: string,
    panelId: string,
    updater: (panel: LayoutPanel) => LayoutPanel
  ) =>
    updateTab(tabId, tab => ({
      ...tab,
      panels: tab.panels.map(panel => (panel.id === panelId ? updater(panel) : panel))
    }));

  const addTab = () => {
    const id = newId('tab');
    updateTabs(tabs => [...tabs, { id, title: 'New tab', columns: 1 as const, panels: [] }]);
    setActiveTabId(id);
  };

  const removeTab = (tabId: string) => {
    updateTabs(tabs => tabs.filter(tab => tab.id !== tabId));
    if (tabId === activeTabId) {
      const remaining = layout.tabs.filter(tab => tab.id !== tabId);
      setActiveTabId(remaining[0]?.id);
    }
  };

  const setTabColumns = (tabId: string, columns: 1 | 2) =>
    updateTab(tabId, tab => ({ ...tab, columns }));

  const addPanel = (tabId: string, column: 1 | 2, groupId: string | undefined) =>
    updateTab(tabId, tab => ({
      ...tab,
      panels: [
        ...tab.panels,
        groupId
          ? {
              id: newId('panel'),
              title: groups.find(g => g.id === groupId)?.name ?? groupId,
              collapsible: false,
              column,
              blocks: [{ id: newId('block'), kind: 'fieldGroup' as const, refId: groupId }]
            }
          : { id: newId('panel'), title: 'New panel', collapsible: true, column, blocks: [] }
      ]
    }));

  const setPanelColumn = (tabId: string, panelId: string, column: 1 | 2) =>
    updatePanel(tabId, panelId, panel => ({ ...panel, column }));

  const addBlock = (tabId: string, panelId: string, kind: LayoutBlockKind, refId?: string) =>
    updatePanel(tabId, panelId, panel => ({
      ...panel,
      blocks: [...panel.blocks, { id: newId('block'), kind, refId }]
    }));

  const removeBlock = (tabId: string, panelId: string, blockId: string) =>
    updatePanel(tabId, panelId, panel => ({
      ...panel,
      blocks: panel.blocks.filter(block => block.id !== blockId)
    }));

  const moveBlock = (tabId: string, panelId: string, index: number, direction: -1 | 1) =>
    updatePanel(tabId, panelId, panel => ({
      ...panel,
      blocks: moveItem(panel.blocks, index, direction)
    }));

  const soleGroupBlock = (panel: LayoutPanel) =>
    panel.blocks.length === 1 && panel.blocks[0]!.kind === 'fieldGroup'
      ? panel.blocks[0]
      : undefined;

  const addBlockOptions = (): AddBlockOptionGroups => {
    const options: AddBlockOptionGroups = { fields: [], metadata: [], relations: [], other: [] };
    for (const field of fields) {
      if (!placed.fieldIds.has(field.id) && !field.groupId)
        options.fields.push({
          value: `field:${field.id}`,
          label: field.name,
          kind: 'field',
          refId: field.id
        });
    }
    for (const slot of ALL_METADATA_SLOTS) {
      if (!placed.metadataSlots.has(slot))
        options.metadata.push({
          value: `metadata:${slot}`,
          label: METADATA_SLOT_LABELS[slot],
          kind: 'metadata',
          refId: slot
        });
    }
    for (const relationSchema of relationSchemas) {
      if (!placed.relationSchemaIds.has(relationSchema.id))
        options.relations.push({
          value: `unboundTypedRelation:${relationSchema.id}`,
          label: relationSchema.name,
          kind: 'unboundTypedRelation',
          refId: relationSchema.id
        });
    }
    if (!placed.hasLinks) options.other.push({ value: 'links', label: 'Links', kind: 'links' });
    if (!placed.hasProjects)
      options.other.push({ value: 'projects', label: 'Projects', kind: 'projects' });
    if (!placed.hasDiagrams)
      options.other.push({ value: 'diagrams', label: 'Diagrams', kind: 'diagrams' });
    return options;
  };

  return (
    <div>
      <div className={styles.topbar}>
        <div className={styles.sectionLabel}>Detail/Edit layout</div>
        {activeTab && (
          <div className={styles.colPick}>
            <span>Columns</span>
            <Segmented
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' }
              ]}
              value={activeTab.columns ?? 1}
              disabled={!canEdit}
              onChange={value => setTabColumns(activeTab.id, value)}
            />
          </div>
        )}
      </div>

      {layout.tabs.length > 1 && (
        <div className={styles.tabStrip}>
          {layout.tabs.map((tab, tabIndex) => (
            <div
              key={tab.id}
              className={styles.tabChip}
              data-active={tab.id === activeTab?.id}
              onClick={() => setActiveTabId(tab.id)}
            >
              <input
                className={styles.tabChipInput}
                value={tab.title}
                disabled={!canEdit}
                onChange={e => updateTab(tab.id, t => ({ ...t, title: e.target.value }))}
                onClick={e => e.stopPropagation()}
              />
              {canEdit && (
                <span className={styles.tabChipActions}>
                  <Button
                    variant="icon-only"
                    size="xs"
                    disabled={tabIndex === 0}
                    aria-label="Move tab up"
                    onClick={e => {
                      e.stopPropagation();
                      updateTabs(tabs => moveItem(tabs, tabIndex, -1));
                    }}
                  >
                    <TbChevronUp size={11} />
                  </Button>
                  <Button
                    variant="icon-only"
                    size="xs"
                    disabled={tabIndex === layout.tabs.length - 1}
                    aria-label="Move tab down"
                    onClick={e => {
                      e.stopPropagation();
                      updateTabs(tabs => moveItem(tabs, tabIndex, 1));
                    }}
                  >
                    <TbChevronDown size={11} />
                  </Button>
                  <Button
                    variant="icon-only"
                    size="xs"
                    aria-label="Remove tab"
                    onClick={e => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                  >
                    <TbTrash size={11} />
                  </Button>
                </span>
              )}
            </div>
          ))}
          {canEdit && (
            <button type="button" className={styles.addTab} onClick={addTab}>
              <TbPlus size={11} /> Add tab
            </button>
          )}
        </div>
      )}
      {layout.tabs.length === 1 && canEdit && (
        <button type="button" className={`${styles.addTab} ${styles.addTabSolo}`} onClick={addTab}>
          <TbPlus size={11} /> Add tab
        </button>
      )}

      {activeTab && (
        <div
          className={`${styles.canvas} ${activeTab.columns === 2 ? styles.canvas2 : styles.canvas1}`}
        >
          {Array.from({ length: activeTab.columns ?? 1 }).map((_, colIdx) => {
            const column = (colIdx + 1) as 1 | 2;
            const panels = activeTab.panels.filter(panel => (panel.column ?? 1) === column);
            return (
              <div key={column} className={styles.column}>
                {panels.length === 0 && <div className={styles.columnEmpty}>No panels yet</div>}
                {panels.map((panel, panelIndex) => {
                  const groupBlock = soleGroupBlock(panel);
                  const isGroup = !!groupBlock;
                  const groupFields = isGroup
                    ? fields.filter(f => f.groupId === groupBlock!.refId)
                    : [];

                  return (
                    <div
                      key={panel.id}
                      className={`${styles.panel} ${isGroup ? styles.panelLinked : ''}`}
                    >
                      <div className={styles.panelHead}>
                        <TextInput
                          value={panel.title}
                          readOnly={!canEdit || isGroup}
                          onChange={value =>
                            updatePanel(activeTab.id, panel.id, p => ({
                              ...p,
                              title: value ?? ''
                            }))
                          }
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        {isGroup && (
                          <span className={styles.linkedTag}>
                            <TbLock size={10} /> Group
                          </span>
                        )}
                        {canEdit && !isGroup && (
                          <label className={styles.panelCollapsible}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={panel.collapsible !== false}
                              onChange={e =>
                                updatePanel(activeTab.id, panel.id, p => ({
                                  ...p,
                                  collapsible: e.target.checked
                                }))
                              }
                            />
                            Collapsible
                          </label>
                        )}
                        {canEdit && (
                          <span className={styles.panelActions}>
                            <Button
                              variant="icon-only"
                              size="xs"
                              disabled={panelIndex === 0}
                              aria-label="Move panel up"
                              onClick={() =>
                                updateTab(activeTab.id, t => ({
                                  ...t,
                                  panels: moveItem(
                                    t.panels,
                                    t.panels.findIndex(p => p.id === panel.id),
                                    -1
                                  )
                                }))
                              }
                            >
                              <TbChevronUp size={12} />
                            </Button>
                            <Button
                              variant="icon-only"
                              size="xs"
                              disabled={panelIndex === panels.length - 1}
                              aria-label="Move panel down"
                              onClick={() =>
                                updateTab(activeTab.id, t => ({
                                  ...t,
                                  panels: moveItem(
                                    t.panels,
                                    t.panels.findIndex(p => p.id === panel.id),
                                    1
                                  )
                                }))
                              }
                            >
                              <TbChevronDown size={12} />
                            </Button>
                            <Button
                              variant="icon-only"
                              size="xs"
                              aria-label="Remove panel"
                              onClick={() =>
                                updateTab(activeTab.id, t => ({
                                  ...t,
                                  panels: t.panels.filter(p => p.id !== panel.id)
                                }))
                              }
                            >
                              <TbTrash size={12} />
                            </Button>
                          </span>
                        )}
                      </div>

                      {canEdit && activeTab.columns === 2 && (
                        <div className={styles.panelMeta}>
                          <span>Column</span>
                          <Segmented
                            options={[
                              { value: 1, label: '1' },
                              { value: 2, label: '2' }
                            ]}
                            value={panel.column ?? 1}
                            onChange={value => setPanelColumn(activeTab.id, panel.id, value)}
                          />
                        </div>
                      )}

                      {isGroup ? (
                        <div className={styles.blockList}>
                          {groupFields.length === 0 && (
                            <div className={styles.emptyInline}>This group has no fields yet</div>
                          )}
                          {groupFields.map(field => (
                            <div key={field.id} className={styles.block}>
                              <span className={styles.blockIcon}>
                                <TbSquare size={11} />
                              </span>
                              <span className={styles.blockLabel}>{field.name}</span>
                              <TbLock size={10} className={styles.blockIcon} />
                            </div>
                          ))}
                          <div className={styles.hint}>
                            <TbInfoCircle size={10} /> Membership is edited on the Fields tab.
                          </div>
                        </div>
                      ) : (
                        <div className={styles.blockList}>
                          {panel.blocks.length === 0 && (
                            <div className={styles.emptyInline}>Add a block to fill this panel</div>
                          )}
                          {panel.blocks.map((block, blockIndex) => {
                            const BlockIcon = KIND_ICON[block.kind] ?? TbSquare;
                            return (
                              <div key={block.id} className={styles.block}>
                                <span className={styles.blockIcon}>
                                  <BlockIcon size={11} />
                                </span>
                                <span className={styles.blockLabel}>
                                  {blockLabel(block, fieldsById, relationSchemasById)}
                                </span>
                                {canEdit && (
                                  <span className={styles.blockOrder}>
                                    <Button
                                      variant="icon-only"
                                      size="xs"
                                      disabled={blockIndex === 0}
                                      aria-label="Move block up"
                                      onClick={() =>
                                        moveBlock(activeTab.id, panel.id, blockIndex, -1)
                                      }
                                    >
                                      <TbChevronUp size={10} />
                                    </Button>
                                    <Button
                                      variant="icon-only"
                                      size="xs"
                                      disabled={blockIndex === panel.blocks.length - 1}
                                      aria-label="Move block down"
                                      onClick={() =>
                                        moveBlock(activeTab.id, panel.id, blockIndex, 1)
                                      }
                                    >
                                      <TbChevronDown size={10} />
                                    </Button>
                                  </span>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    className={styles.blockRemove}
                                    aria-label="Remove block"
                                    onClick={() => removeBlock(activeTab.id, panel.id, block.id)}
                                  >
                                    <TbX size={10} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {canEdit && (
                            <AddBlockMenu
                              options={addBlockOptions()}
                              onAdd={(kind, refId) => addBlock(activeTab.id, panel.id, kind, refId)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {canEdit && (
                  <AddPanelMenu
                    unplacedGroups={unplacedGroups}
                    onAdd={groupId => addPanel(activeTab.id, column, groupId)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
