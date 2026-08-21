import { TbChevronDown, TbChevronUp, TbPlus, TbTrash } from 'react-icons/tb';
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
import styles from './SchemaSettingsScreen.module.css';

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
  const fieldsById = new Map(fields.map(field => [field.id, field]));
  const relationSchemasById = new Map(relationSchemas.map(rs => [rs.id, rs]));
  const placed = computePlaced(layout);

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

  const addTab = () =>
    updateTabs(tabs => [
      ...tabs,
      { id: newId('tab'), title: 'New tab', columns: 1 as const, panels: [] }
    ]);

  const setTabColumns = (tabId: string, columns: 1 | 2) =>
    updateTab(tabId, tab => ({ ...tab, columns }));

  const addPanel = (tabId: string) =>
    updateTab(tabId, tab => ({
      ...tab,
      panels: [
        ...tab.panels,
        {
          id: newId('panel'),
          title: 'New panel',
          collapsible: true,
          column: 1 as const,
          blocks: []
        }
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

  const linkPanelToGroup = (tabId: string, panelId: string, groupId: string) =>
    updatePanel(tabId, panelId, panel => ({
      ...panel,
      blocks: [{ id: newId('block'), kind: 'fieldGroup', refId: groupId }]
    }));

  const unlinkPanel = (tabId: string, panelId: string) =>
    updatePanel(tabId, panelId, panel => ({ ...panel, blocks: [] }));

  const soleGroupBlock = (panel: LayoutPanel) =>
    panel.blocks.length === 1 && panel.blocks[0]!.kind === 'fieldGroup'
      ? panel.blocks[0]
      : undefined;

  const addBlockOptions = (panel: LayoutPanel) => {
    const options: Array<{ value: string; label: string; kind: LayoutBlockKind; refId?: string }> =
      [];
    for (const field of fields) {
      if (!placed.fieldIds.has(field.id) && !field.groupId)
        options.push({
          value: `field:${field.id}`,
          label: `Field: ${field.name}`,
          kind: 'field',
          refId: field.id
        });
    }
    for (const slot of ALL_METADATA_SLOTS) {
      if (!placed.metadataSlots.has(slot))
        options.push({
          value: `metadata:${slot}`,
          label: `Metadata: ${METADATA_SLOT_LABELS[slot]}`,
          kind: 'metadata',
          refId: slot
        });
    }
    if (!placed.hasLinks) options.push({ value: 'links', label: 'Links', kind: 'links' });
    for (const relationSchema of relationSchemas) {
      if (!placed.relationSchemaIds.has(relationSchema.id))
        options.push({
          value: `unboundTypedRelation:${relationSchema.id}`,
          label: `Unbound relation: ${relationSchema.name}`,
          kind: 'unboundTypedRelation',
          refId: relationSchema.id
        });
    }
    if (!placed.hasProjects)
      options.push({ value: 'projects', label: 'Projects', kind: 'projects' });
    if (!placed.hasDiagrams)
      options.push({ value: 'diagrams', label: 'Diagrams', kind: 'diagrams' });
    void panel;
    return options;
  };

  return (
    <div>
      <div className={styles.fieldsHead}>
        <div className={styles.sectionLabel}>Detail/Edit layout</div>
        {canEdit && (
          <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addTab}>
            Add tab
          </Button>
        )}
      </div>

      {layout.tabs.map((tab, tabIndex) => (
        <div
          key={tab.id}
          className={styles.templateRow}
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canEdit ? (
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={tabIndex === 0}
                  aria-label="Move tab up"
                  onClick={() => updateTabs(tabs => moveItem(tabs, tabIndex, -1))}
                >
                  <TbChevronUp size={13} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={tabIndex === layout.tabs.length - 1}
                  aria-label="Move tab down"
                  onClick={() => updateTabs(tabs => moveItem(tabs, tabIndex, 1))}
                >
                  <TbChevronDown size={13} />
                </button>
              </div>
            ) : (
              <span />
            )}
            <TextInput
              value={tab.title}
              readOnly={!canEdit}
              onChange={value => updateTab(tab.id, t => ({ ...t, title: value ?? '' }))}
              style={{ flex: 1 }}
            />
            {canEdit && (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Remove tab"
                onClick={() => updateTabs(tabs => tabs.filter(t => t.id !== tab.id))}
              >
                <TbTrash size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--cmp-fg-disabled)' }}>Columns:</span>
            <select
              className={styles.selectInline}
              disabled={!canEdit}
              value={tab.columns ?? 1}
              onChange={e => setTabColumns(tab.id, Number(e.target.value) === 2 ? 2 : 1)}
            >
              <option value={1}>1 (single column)</option>
              <option value={2}>2 (properties / sidebar)</option>
            </select>
          </div>

          <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tab.panels.map((panel, panelIndex) => {
              const groupBlock = soleGroupBlock(panel);
              return (
                <div
                  key={panel.id}
                  style={{
                    border: '1px solid var(--panel-border)',
                    borderRadius: 'var(--r-md)',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {canEdit ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          disabled={panelIndex === 0}
                          aria-label="Move panel up"
                          onClick={() =>
                            updateTab(tab.id, t => ({
                              ...t,
                              panels: moveItem(t.panels, panelIndex, -1)
                            }))
                          }
                        >
                          <TbChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          disabled={panelIndex === tab.panels.length - 1}
                          aria-label="Move panel down"
                          onClick={() =>
                            updateTab(tab.id, t => ({
                              ...t,
                              panels: moveItem(t.panels, panelIndex, 1)
                            }))
                          }
                        >
                          <TbChevronDown size={13} />
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}
                    <TextInput
                      value={panel.title}
                      readOnly={!canEdit}
                      onChange={value =>
                        updatePanel(tab.id, panel.id, p => ({ ...p, title: value ?? '' }))
                      }
                      style={{ flex: 1 }}
                    />
                    {canEdit && (
                      <label
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <input
                          type="checkbox"
                          checked={panel.collapsible !== false}
                          onChange={e =>
                            updatePanel(tab.id, panel.id, p => ({
                              ...p,
                              collapsible: e.target.checked
                            }))
                          }
                        />
                        Collapsible
                      </label>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Remove panel"
                        onClick={() =>
                          updateTab(tab.id, t => ({
                            ...t,
                            panels: t.panels.filter(p => p.id !== panel.id)
                          }))
                        }
                      >
                        <TbTrash size={13} />
                      </button>
                    )}
                  </div>

                  {canEdit && tab.columns === 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--cmp-fg-disabled)' }}>Column:</span>
                      <select
                        className={styles.selectInline}
                        value={panel.column ?? 1}
                        onChange={e =>
                          setPanelColumn(tab.id, panel.id, Number(e.target.value) === 2 ? 2 : 1)
                        }
                      >
                        <option value={1}>1 (main)</option>
                        <option value={2}>2 (sidebar)</option>
                      </select>
                    </div>
                  )}

                  {canEdit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--cmp-fg-disabled)' }}>Field group:</span>
                      <select
                        className={styles.selectInline}
                        value={groupBlock?.refId ?? ''}
                        onChange={e =>
                          e.target.value
                            ? linkPanelToGroup(tab.id, panel.id, e.target.value)
                            : unlinkPanel(tab.id, panel.id)
                        }
                      >
                        <option value="">— free-form —</option>
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!groupBlock && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {panel.blocks.map((block, blockIndex) => (
                        <div
                          key={block.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          {canEdit ? (
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                disabled={blockIndex === 0}
                                aria-label="Move block up"
                                onClick={() => moveBlock(tab.id, panel.id, blockIndex, -1)}
                              >
                                <TbChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                disabled={blockIndex === panel.blocks.length - 1}
                                aria-label="Move block down"
                                onClick={() => moveBlock(tab.id, panel.id, blockIndex, 1)}
                              >
                                <TbChevronDown size={12} />
                              </button>
                            </div>
                          ) : (
                            <span />
                          )}
                          <span style={{ flex: 1 }}>
                            {blockLabel(block, fieldsById, relationSchemasById)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Remove block"
                              onClick={() => removeBlock(tab.id, panel.id, block.id)}
                            >
                              <TbTrash size={12} />
                            </button>
                          )}
                        </div>
                      ))}

                      {canEdit && (
                        <select
                          className={styles.selectInline}
                          value=""
                          onChange={e => {
                            const option = addBlockOptions(panel).find(
                              candidate => candidate.value === e.target.value
                            );
                            if (option) addBlock(tab.id, panel.id, option.kind, option.refId);
                          }}
                        >
                          <option value="">+ Add block…</option>
                          {addBlockOptions(panel).map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {canEdit && (
              <Button variant="ghost" icon={<TbPlus size={11} />} onClick={() => addPanel(tab.id)}>
                Add panel
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
