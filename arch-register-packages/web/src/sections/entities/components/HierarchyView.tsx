import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import styles from './HierarchyView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { Popover } from '@diagram-craft/app-components/Popover';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { hierarchyViewConfigSchema } from '@arch-register/api-types/viewContract';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HierarchyConfig = {
  levels: number;
  level1SchemaId: string | null;
  level1Columns: number;
  level2SchemaId: string | null;
  level2Columns: number;
  level3SchemaId: string | null;
  level3Columns: number;
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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: HierarchyConfig = {
  levels: 2,
  level1SchemaId: null,
  level1Columns: 3,
  level2SchemaId: null,
  level2Columns: 3,
  level3SchemaId: null,
  level3Columns: 3
};

const normalizeHierarchyConfig = (
  config:
    | {
        levels: number;
        level1SchemaId: string | null;
        level1Columns: number;
        level2SchemaId?: string | null;
        level2Columns?: number;
        level3SchemaId?: string | null;
        level3Columns?: number;
      }
    | null
    | undefined
): HierarchyConfig => ({
  levels: config?.levels ?? DEFAULT_CONFIG.levels,
  level1SchemaId: config?.level1SchemaId ?? DEFAULT_CONFIG.level1SchemaId,
  level1Columns: config?.level1Columns ?? DEFAULT_CONFIG.level1Columns,
  level2SchemaId: config?.level2SchemaId ?? DEFAULT_CONFIG.level2SchemaId,
  level2Columns: config?.level2Columns ?? DEFAULT_CONFIG.level2Columns,
  level3SchemaId: config?.level3SchemaId ?? DEFAULT_CONFIG.level3SchemaId,
  level3Columns: config?.level3Columns ?? DEFAULT_CONFIG.level3Columns
});

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

const getChildSchemas = (schemas: EntitySchema[], parentSchemaId: string | null): EntitySchema[] => {
  if (!parentSchemaId) return schemas;
  // The containment field lives on the CHILD schema and its schemaId points to the parent schema.
  // So child schemas of parentSchemaId are those that have a containment field referencing it.
  return schemas.filter(s =>
    s.fields.some(
      (f): f is Extract<(typeof s.fields)[number], { type: 'containment' }> =>
        f.type === 'containment' && f.schemaId === parentSchemaId
    )
  );
};

const nodeName = (n: TreeNode) => n._name || n._slug;

// ── EntityTooltip ─────────────────────────────────────────────────────────────

const EntityTooltip = ({
  node,
  color,
  schemaName,
  isLinked,
  children
}: {
  node: TreeNode;
  color: string;
  schemaName: string;
  isLinked: boolean;
  children: React.ReactNode;
}) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(
    () => () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  const clearTimers = () => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  };

  const scheduleOpen = () => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.tooltipAnchor}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        {children}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Content
          anchor={anchorRef}
          side="top"
          align="start"
          sideOffset={6}
          arrow={false}
          focus={false}
          closeButton={false}
          className={styles.tooltipPanel}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
        >
          <div
            className={styles.tooltipBody}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
          >
            <h4
              className={styles.tooltipTitle}
              style={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
            >
              {nodeName(node)}
            </h4>

            {node._description && (
              <p className={styles.tooltipDesc}>{node._description}</p>
            )}

            <div className={styles.tooltipRows}>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Type</span>
                <span className={styles.tooltipValue}>
                  <span className={styles.tooltipDot} style={{ background: color }} />
                  {schemaName}
                </span>
              </div>
              {node._lifecycle && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Status</span>
                  <span className={styles.tooltipValue}>{node._lifecycle.name}</span>
                </div>
              )}
              {node._owner && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Owner</span>
                  <span className={styles.tooltipValue}>{node._owner.name}</span>
                </div>
              )}
            </div>

            {node._tags.length > 0 && (
              <div className={styles.tooltipTags}>
                {node._tags.map(tag => (
                  <span key={tag} className={styles.tooltipTag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
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

const ColsSelect = ({
  value,
  onChange
}: {
  value: number;
  onChange: (n: number) => void;
}) => (
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
  hideToolbar
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
  const parsedConfig = useMemo(() => {
    const result = hierarchyViewConfigSchema.safeParse(config);
    return result.success ? normalizeHierarchyConfig(result.data) : null;
  }, [config]);
  const [localConfig, setLocalConfig] = useState<HierarchyConfig>(parsedConfig ?? DEFAULT_CONFIG);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const cfg = parsedConfig ?? localConfig;

  const notify = useCallback(
    (patch: Partial<HierarchyConfig>) => {
      const next = { ...cfg, ...patch };
      setLocalConfig(next);
      onConfigChange(next);
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

  const { nodeMap, childrenOf } = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    for (const n of nodes) nodeMap.set(n._uid, n);

    const childrenOf = new Map<string, string[]>();
    for (const { childId, parentId } of edges) {
      const arr = childrenOf.get(parentId) ?? [];
      arr.push(childId);
      childrenOf.set(parentId, arr);
    }
    return { nodeMap, childrenOf };
  }, [nodes, edges]);

  const level1Items = useMemo(
    () =>
      nodes
        .filter(n => n._schema.id === cfg.level1SchemaId && n._isMatch)
        .sort((a, b) => nodeName(a).localeCompare(nodeName(b))),
    [nodes, cfg.level1SchemaId]
  );

  const getLevel2Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level2SchemaId) return [];
      return (childrenOf.get(parentUid) ?? [])
        .map(id => nodeMap.get(id))
        .filter((n): n is TreeNode => !!n && n._schema.id === cfg.level2SchemaId && n._isMatch)
        .sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
    },
    [childrenOf, nodeMap, cfg.level2SchemaId]
  );

  const getLevel3Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level3SchemaId) return [];
      return (childrenOf.get(parentUid) ?? [])
        .map(id => nodeMap.get(id))
        .filter((n): n is TreeNode => !!n && n._schema.id === cfg.level3SchemaId && n._isMatch)
        .sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
    },
    [childrenOf, nodeMap, cfg.level3SchemaId]
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
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Select a schema for Level 1</div>
          <div className={styles.emptySub}>
            Use the controls above to choose which entity types to display at each level.
          </div>
        </div>
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
                                        isLinked={linkedEntityIds == null || linkedEntityIdSet.has(l3._uid)}
                                      >
                                        <button
                                          type="button"
                                          className={styles.entityLink}
                                          onClick={() => onEntityClick(l3._publicId)}
                                          style={
                                            linkedEntityIds != null && !linkedEntityIdSet.has(l3._uid)
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
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No entities found</div>
              <div className={styles.emptySub}>Try adjusting your search or filters.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
