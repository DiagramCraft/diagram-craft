import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { useEntities, useEntitiesByIdSetQuery } from '../../../hooks/useEntities';
import { EntityHoverCard } from '../../../components/EntityHoverCard';
import styles from './PathWalkerView.module.css';
import {
  PATH_WALKER_PROJECTION_ALIAS,
  buildHopColumnQuery,
  decodeHopColumnNodes,
  pathStepKey,
  type HopColumnNode
} from './pathWalkerViewState';
import { useHopFanoutCounts } from './useHopFanoutCounts';

type WalkerColumnProps = {
  workspaceId: string;
  /** 1-based column index; this column is reached from the previous column via `hop`. */
  depth: number;
  fromEntityId: string;
  hop: PathStep;
  columnLabel: string;
  selectedId?: string;
  /** Whether this column should preselect its first entity - true only when a further hop is
   *  already chosen from it (so it's an intermediate step, not the frontier column). */
  autoSelectFirst: boolean;
  /** The hop chosen leaving this column, if any - drives the per-row "leads to N" counts. */
  nextHop?: PathStep;
  onSelect: (depth: number, entityId: string) => void;
  onOpen: (publicId: string) => void;
  renderBadge: (schemaId: string | undefined) => ReactNode;
};

export const WalkerColumn = ({
  workspaceId,
  depth,
  fromEntityId,
  hop,
  columnLabel,
  selectedId,
  autoSelectFirst,
  nextHop,
  onSelect,
  onOpen,
  renderBadge
}: WalkerColumnProps) => {
  const entityQuery = useMemo(() => buildHopColumnQuery(fromEntityId, hop), [fromEntityId, hop]);
  const { data, isLoading } = useEntities(workspaceId, { view: 'full', entityQuery, limit: 1 });
  const showLoading = useDelayedFlag(isLoading, 300);

  const nodes = useMemo<HopColumnNode[]>(
    () => decodeHopColumnNodes(data[0]?._projections?.[PATH_WALKER_PROJECTION_ALIAS]),
    [data]
  );
  const nodeIds = useMemo(() => nodes.map(node => node.id), [nodes]);
  const nodeRecords = useEntitiesByIdSetQuery(workspaceId, nodeIds).data;
  const fanout = useHopFanoutCounts(workspaceId, nodeIds, nextHop);

  // Preselect the first entity in this column once it resolves, so the chain reads end-to-end.
  // Guarded per (source entity + hop) so re-picking the hop re-selects, but a later render with a
  // stale `selectedId` prop can't double-fire.
  const autoSelectedFor = useRef<string | undefined>(undefined);
  const autoKey = `${fromEntityId}::${pathStepKey(hop)}`;
  useEffect(() => {
    if (!autoSelectFirst || selectedId || nodes.length === 0) return;
    if (autoSelectedFor.current === autoKey) return;
    autoSelectedFor.current = autoKey;
    onSelect(depth, nodes[0]!.id);
  }, [autoSelectFirst, selectedId, nodes, autoKey, depth, onSelect]);

  return (
    <div className={styles.column}>
      <div className={styles.columnHead}>
        <span>{columnLabel}</span>
        <span className={styles.count}>{nodes.length}</span>
      </div>
      {isLoading ? (
        showLoading ? <div className={styles.columnEmpty}>Loading…</div> : null
      ) : nodes.length === 0 ? (
        <div className={styles.columnEmpty}>No linked entities — the chain breaks here.</div>
      ) : (
        nodes.map(node => (
          <button
            key={node.id}
            type="button"
            className={`${styles.row} ${selectedId === node.id ? styles.rowActive : ''}`}
            onClick={() => onSelect(depth, node.id)}
          >
            {renderBadge(node.schemaId)}
            <span className={styles.name}>
              <EntityHoverCard
                entityId={node.id}
                extra={
                  <div className={styles.hoverOpenWrap}>
                    <button
                      type="button"
                      className={styles.hoverOpen}
                      disabled={!nodeRecords.get(node.id)}
                      onClick={event => {
                        event.stopPropagation();
                        const publicId = nodeRecords.get(node.id)?._publicId;
                        if (publicId) onOpen(publicId);
                      }}
                    >
                      Open
                    </button>
                  </div>
                }
              >
                {node.name}
              </EntityHoverCard>
            </span>
            {fanout.has(node.id) && <span className={styles.rowMeta}>{fanout.get(node.id)}</span>}
          </button>
        ))
      )}
    </div>
  );
};
