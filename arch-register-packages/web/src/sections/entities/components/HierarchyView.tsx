import { useMemo, useCallback } from 'react';
import styles from './HierarchyView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntityRecord, TreeNode } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { hierarchyViewConfigSchema } from '@arch-register/api-types/viewContract';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import { EmptyState } from '../../../components/EmptyState';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  type EntityDisplayField
} from './entityDisplayFields';
import { normalizeViewConfig } from './entityViewConfig';
import { HoverCard } from '../../../components/HoverCard';
import { EntityHoverCardBody } from '../../../components/EntityHoverCardBody';
import {
  buildHierarchyTreeIndex,
  getChildSchemas,
  getHierarchyChildren,
  sortHierarchyNodes
} from './hierarchyViewState';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HierarchyConfig = {
  levels: number;
  level1SchemaId: string | null;
  level1Columns: number;
  level2SchemaId: string | null;
  level2Columns: number;
  level3SchemaId: string | null;
  level3Columns: number;
  fieldIds?: string[];
};

type HierarchyViewProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  onEntityClick: (entityId: string) => void;
  config: unknown;
  onConfigChange: (cfg: HierarchyConfig) => void;
  linkedEntityIds?: string[];
  hideToolbar?: boolean;
  displayFields: EntityDisplayField[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// `fieldIds` is explicitly included (as undefined) so normalizeViewConfig's field-merge loop
// picks it up from a parsed config when present, matching the previous pass-through behavior.
const DEFAULT_CONFIG: HierarchyConfig = {
  levels: 2,
  level1SchemaId: null,
  level1Columns: 3,
  level2SchemaId: null,
  level2Columns: 3,
  level3SchemaId: null,
  level3Columns: 3,
  fieldIds: undefined
};

const nodeName = (n: TreeNode) => n._name || n._slug;

// ── EntityTooltip ─────────────────────────────────────────────────────────────

const EntityTooltip = ({
  node,
  color,
  schemaName,
  isLinked,
  children,
  displayFields,
  schemaMap
}: {
  node: TreeNode;
  color: string;
  schemaName: string;
  isLinked: boolean;
  children: React.ReactNode;
  displayFields: EntityDisplayField[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
}) => {
  const rows = displayFields
    .filter(f => f.id !== '_description' && f.id !== '_tags')
    .map(option => {
      const field = findEntityDisplayField(option.id, node, schemaMap, displayFields);
      const value = field ? formatEntityDisplayValue(node as EntityRecord, field) : null;
      return value == null ? null : { label: field!.label, value };
    })
    .filter((row): row is { label: string; value: string } => row !== null);

  return (
    <HoverCard
      anchorClassName={styles.tooltipAnchor}
      sideOffset={6}
      content={
        <EntityHoverCardBody
          name={nodeName(node)}
          description={displayFields.some(f => f.id === '_description') ? node._description : null}
          schemaName={schemaName}
          schemaColor={color}
          tags={displayFields.some(f => f.id === '_tags') ? node._tags : undefined}
          rows={rows}
          titleStyle={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
        />
      }
    >
      {children}
    </HoverCard>
  );
};

// ── Config sub-components ─────────────────────────────────────────────────────

const SchemaSelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null;
  options: EntitySchema[];
  onChange: (id: string | null) => void;
}) => (
  <div className={styles.axisPill}>
    <span className={styles.axisKicker}>{label}</span>
    <div className={styles.selectWrap}>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— select —</option>
        {options.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <TbChevronDown size={11} />
    </div>
  </div>
);

const ColsSelect = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className={styles.selectWrap}>
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    >
      {[1, 2, 3, 4].map(n => (
        <option key={n} value={n}>
          {n} col{n > 1 ? 's' : ''}
        </option>
      ))}
    </select>
    <TbChevronDown size={11} />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const HierarchyView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  displayFields
}: HierarchyViewProps) => {
  const { schemas } = useWorkspaceContext();
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter
  });
  const cfg = useMemo(
    () => normalizeViewConfig(hierarchyViewConfigSchema, config, DEFAULT_CONFIG),
    [config]
  );
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const selectedDisplayFields = getDisplayFieldIds('hierarchy', cfg).map(
    id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
  );

  const notify = useCallback(
    (patch: Partial<HierarchyConfig>) => {
      onConfigChange({ ...cfg, ...patch });
    },
    [cfg, onConfigChange]
  );

  const level2SchemaOptions = useMemo(
    () => getChildSchemas(schemas, cfg.level1SchemaId),
    [schemas, cfg.level1SchemaId]
  );

  const level3SchemaOptions = useMemo(
    () => getChildSchemas(schemas, cfg.level2SchemaId ?? null),
    [schemas, cfg.level2SchemaId]
  );

  const treeIndex = useMemo(() => buildHierarchyTreeIndex(nodes, edges), [nodes, edges]);

  const level1Items = useMemo(
    () => sortHierarchyNodes(nodes, cfg.level1SchemaId),
    [nodes, cfg.level1SchemaId]
  );

  const getLevel2Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level2SchemaId) return [];
      return getHierarchyChildren(parentUid, cfg.level2SchemaId, treeIndex);
    },
    [treeIndex, cfg.level2SchemaId]
  );

  const getLevel3Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level3SchemaId) return [];
      return getHierarchyChildren(parentUid, cfg.level3SchemaId, treeIndex);
    },
    [treeIndex, cfg.level3SchemaId]
  );

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  const isUnconfigured = !cfg.level1SchemaId;

  return (
    <div className={styles.wrap}>
      {/* Config bar */}
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Levels</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={cfg.levels}
                onChange={e => {
                  const n = Number(e.target.value);
                  notify({ levels: n, level3SchemaId: n < 3 ? null : cfg.level3SchemaId });
                }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <span className={styles.cross}>|</span>

          <SchemaSelect
            label="L1"
            value={cfg.level1SchemaId}
            options={schemas}
            onChange={id =>
              notify({ level1SchemaId: id, level2SchemaId: null, level3SchemaId: null })
            }
          />
          <ColsSelect value={cfg.level1Columns} onChange={n => notify({ level1Columns: n })} />

          {cfg.levels >= 2 && (
            <>
              <span className={styles.cross}>›</span>
              <SchemaSelect
                label="L2"
                value={cfg.level2SchemaId ?? null}
                options={level2SchemaOptions}
                onChange={id => notify({ level2SchemaId: id, level3SchemaId: null })}
              />
              <ColsSelect value={cfg.level2Columns} onChange={n => notify({ level2Columns: n })} />
            </>
          )}

          {cfg.levels >= 3 && (
            <>
              <span className={styles.cross}>›</span>
              <SchemaSelect
                label="L3"
                value={cfg.level3SchemaId ?? null}
                options={level3SchemaOptions}
                onChange={id => notify({ level3SchemaId: id })}
              />
              <ColsSelect value={cfg.level3Columns} onChange={n => notify({ level3Columns: n })} />
            </>
          )}
        </div>
      )}

      {/* Content */}
      {isUnconfigured ? (
        <EmptyState
          title="Select a schema for Level 1"
          subtitle="Use the controls above to choose which entity types to display at each level."
        />
      ) : (
        <div className={styles.scroll}>
          <div
            className={styles.level1Grid}
            style={{ gridTemplateColumns: `repeat(${cfg.level1Columns}, 1fr)` }}
          >
            {level1Items.map(l1 => {
              const l2Children = cfg.levels >= 2 ? getLevel2Children(l1._uid) : [];
              const schemaEntry = schemaMap.get(l1._schema.id);
              const color = schemaEntry
                ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
                : 'var(--accent-fg)';

              return (
                <div key={l1._uid} className={styles.level1Box}>
                  <div className={styles.levelHeader}>
                    <span className={styles.colorDot} style={{ background: color }} />
                    <EntityTooltip
                      node={l1}
                      color={color}
                      schemaName={schemaEntry?.schema.name ?? l1._schema.name}
                      isLinked={linkedEntityIds == null || linkedEntityIdSet.has(l1._uid)}
                      displayFields={selectedDisplayFields}
                      schemaMap={schemaMap}
                    >
                      <button
                        type="button"
                        className={styles.entityLink}
                        onClick={() => onEntityClick(l1._publicId)}
                        style={
                          linkedEntityIds != null && !linkedEntityIdSet.has(l1._uid)
                            ? { color: 'var(--base-fg-more-dim)' }
                            : undefined
                        }
                      >
                        {nodeName(l1)}
                      </button>
                    </EntityTooltip>
                  </div>

                  {cfg.levels >= 2 && l2Children.length > 0 && (
                    <div
                      className={styles.childGrid}
                      style={{ gridTemplateColumns: `repeat(${cfg.level2Columns}, 1fr)` }}
                    >
                      {l2Children.map(l2 => {
                        const l3Children = cfg.levels >= 3 ? getLevel3Children(l2._uid) : [];
                        const l2SchemaEntry = schemaMap.get(l2._schema.id);
                        const l2Color = l2SchemaEntry
                          ? resolveSchemaColor(l2SchemaEntry.schema, l2SchemaEntry.index)
                          : 'var(--accent-fg)';

                        return (
                          <div key={l2._uid} className={styles.level2Box}>
                            <div className={styles.levelHeader}>
                              <span className={styles.colorDot} style={{ background: l2Color }} />
                              <EntityTooltip
                                node={l2}
                                color={l2Color}
                                schemaName={l2SchemaEntry?.schema.name ?? l2._schema.name}
                                isLinked={linkedEntityIds == null || linkedEntityIdSet.has(l2._uid)}
                                displayFields={selectedDisplayFields}
                                schemaMap={schemaMap}
                              >
                                <button
                                  type="button"
                                  className={styles.entityLink}
                                  onClick={() => onEntityClick(l2._publicId)}
                                  style={
                                    linkedEntityIds != null && !linkedEntityIdSet.has(l2._uid)
                                      ? { color: 'var(--base-fg-more-dim)' }
                                      : undefined
                                  }
                                >
                                  {nodeName(l2)}
                                </button>
                              </EntityTooltip>
                            </div>

                            {cfg.levels >= 3 && l3Children.length > 0 && (
                              <div
                                className={styles.childGrid}
                                style={{
                                  gridTemplateColumns: `repeat(${cfg.level3Columns}, 1fr)`
                                }}
                              >
                                {l3Children.map(l3 => {
                                  const l3SchemaEntry = schemaMap.get(l3._schema.id);
                                  const l3Color = l3SchemaEntry
                                    ? resolveSchemaColor(l3SchemaEntry.schema, l3SchemaEntry.index)
                                    : 'var(--accent-fg)';

                                  return (
                                    <div key={l3._uid} className={styles.level3Box}>
                                      <span
                                        className={styles.colorDot}
                                        style={{ background: l3Color }}
                                      />
                                      <EntityTooltip
                                        node={l3}
                                        color={l3Color}
                                        schemaName={l3SchemaEntry?.schema.name ?? l3._schema.name}
                                        isLinked={
                                          linkedEntityIds == null || linkedEntityIdSet.has(l3._uid)
                                        }
                                        displayFields={selectedDisplayFields}
                                        schemaMap={schemaMap}
                                      >
                                        <button
                                          type="button"
                                          className={styles.entityLink}
                                          onClick={() => onEntityClick(l3._publicId)}
                                          style={
                                            linkedEntityIds != null &&
                                            !linkedEntityIdSet.has(l3._uid)
                                              ? { color: 'var(--base-fg-more-dim)' }
                                              : undefined
                                          }
                                        >
                                          {nodeName(l3)}
                                        </button>
                                      </EntityTooltip>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {level1Items.length === 0 && (
            <EmptyState
              title="No entities found"
              subtitle="Try adjusting your search or filters."
            />
          )}
        </div>
      )}
    </div>
  );
};
