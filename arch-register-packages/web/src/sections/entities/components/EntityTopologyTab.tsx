import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Chip } from '../../../components/Chip';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { Relation } from '../types/entityDetailTypes';
import styles from './EntityTopologyTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { EmptyState } from '../../../components/EmptyState';
import { groupRelationsByField } from './entityTopologyState';

type EdgePath = {
  key: string;
  d: string;
};

type Props = {
  entity: EntityRecord;
  schema: EntitySchema | null;
  color: string;
  outgoing: Relation[];
  incoming: Relation[];
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (entityId: string) => void;
};

export const EntityTopologyTab = ({
  entity,
  schema,
  color,
  outgoing,
  incoming,
  schemas,
  lifecycleStates,
  onEntityClick
}: Props) => {
  const parents = useMemo(() => outgoing.filter(r => r.kind === 'containment'), [outgoing]);
  const children = useMemo(() => incoming.filter(r => r.kind === 'containment'), [incoming]);
  const consumesRefs = useMemo(() => outgoing.filter(r => r.kind === 'reference'), [outgoing]);
  const usedByRefs = useMemo(() => incoming.filter(r => r.kind === 'reference'), [incoming]);

  const containerRef = useRef<HTMLDivElement>(null);
  const entityBoxRef = useRef<HTMLDivElement>(null);
  const refCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [edges, setEdges] = useState<EdgePath[]>([]);
  const topologyVersion = `${parents.length}:${children.length}:${consumesRefs.length}:${usedByRefs.length}`;

  const resolveRelColor = useCallback(
    (rel: Relation) => {
      const idx = schemas.findIndex(s => s.id === rel.entitySchemaId);
      const s = idx >= 0 ? schemas[idx] : null;
      return { schema: s, color: s ? resolveSchemaColor(s, idx) : 'var(--accent-fg)' };
    },
    [schemas]
  );

  const setCardRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) refCardRefs.current.set(key, el);
      else refCardRefs.current.delete(key);
    },
    []
  );

  useLayoutEffect(() => {
    void topologyVersion;
    const container = containerRef.current;
    const entityBox = entityBoxRef.current;
    if (!container || !entityBox) {
      setEdges([]);
      return;
    }

    const compute = () => {
      if (!containerRef.current || !entityBoxRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const eRect = entityBoxRef.current.getBoundingClientRect();
      const next: EdgePath[] = [];

      const entityBottom = eRect.bottom - cRect.top;

      // Compute trunk X for each side based on actual card positions
      let inMaxRight = -Infinity;
      let outMinLeft = Infinity;

      refCardRefs.current.forEach((el, key) => {
        const r = el.getBoundingClientRect();
        if (key.startsWith('in-')) inMaxRight = Math.max(inMaxRight, r.right - cRect.left);
        else outMinLeft = Math.min(outMinLeft, r.left - cRect.left);
      });

      const inTrunkX =
        inMaxRight !== -Infinity ? inMaxRight + 28 : eRect.left - cRect.left + eRect.width * 0.35;
      const outTrunkX =
        outMinLeft !== Infinity ? outMinLeft - 28 : eRect.left - cRect.left + eRect.width * 0.65;

      refCardRefs.current.forEach((el, key) => {
        const r = el.getBoundingClientRect();
        const cardMidY = r.top - cRect.top + r.height / 2;

        if (key.startsWith('out-')) {
          // Consumes: down from entity, right to card
          const cardLeft = r.left - cRect.left - 4;
          const d =
            `M ${outTrunkX} ${entityBottom} L ${outTrunkX} ${cardMidY} L ${cardLeft} ${cardMidY}` +
            ` M ${cardLeft - 4} ${cardMidY - 4} L ${cardLeft} ${cardMidY} L ${cardLeft - 4} ${cardMidY + 4}`;
          next.push({ key, d });
        } else {
          // Used by: from card right, up to entity
          const cardRight = r.right - cRect.left + 4;
          const d =
            `M ${cardRight} ${cardMidY} L ${inTrunkX} ${cardMidY} L ${inTrunkX} ${entityBottom}` +
            ` M ${inTrunkX - 4} ${entityBottom + 4} L ${inTrunkX} ${entityBottom} L ${inTrunkX + 4} ${entityBottom + 4}`;
          next.push({ key, d });
        }
      });

      setEdges(next);
    };

    let raf: number;
    const debouncedCompute = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    debouncedCompute();
    const observer = new ResizeObserver(debouncedCompute);
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [topologyVersion]);

  const isEmpty = parents.length + children.length + consumesRefs.length + usedByRefs.length === 0;

  return (
    <div className={styles.topologyPage} ref={containerRef}>
      <svg className={styles.topoEdgeSvg}>
        {edges.map(edge => (
          <path
            key={edge.key}
            d={edge.d}
            stroke="var(--base-fg-more-dim)"
            strokeWidth={1.2}
            fill="none"
            opacity={0.7}
          />
        ))}
      </svg>

      {parents.length > 0 && (
        <div className={styles.topoParents}>
          <div className={styles.topoParentsItems}>
            {parents.map((p, i) => {
              const { schema: ps, color: pc } = resolveRelColor(p);
              return (
                <button
                  key={i}
                  type="button"
                  className={styles.topoParentChip}
                  onClick={() => onEntityClick(p.publicId)}
                >
                  <TypeBadge color={pc} name={ps?.name} icon={ps?.icon} size={14} />
                  <span className={styles.topoParentName}>{p.entityName}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.topoParentArrowWrap}>
            <svg width="12" height="18" viewBox="0 3 12 18" className={styles.topoParentArrow}>
              <path
                d="M 6 18 L 6 4 M 2 8 L 6 4 L 10 8"
                stroke="var(--base-fg-more-dim)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
            <span className={styles.topoParentPredicate}>
              {getRelationDisplayLabel(parents[0]!)}
            </span>
          </div>
        </div>
      )}

      <div className={styles.topoEntityBox} ref={entityBoxRef}>
        <div className={styles.topoEntityAccent} />
        <div className={styles.topoEntityHead}>
          <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={28} />
          <div className={styles.topoEntityMeta}>
            <div className={styles.topoEntityEyebrow}>{schema?.name ?? 'Entity'}</div>
            <div className={styles.topoEntityName}>{entity._name ?? entity._slug}</div>
          </div>
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </div>

        {children.length > 0 ? (
          <>
            <div className={styles.topoEntitySection}>
              <span>Contains</span>
              <span className={sharedStyles.dim}>({children.length})</span>
            </div>
            <div className={styles.topoChildrenGrid}>
              {children.map((c, i) => {
                const { schema: cs, color: cc } = resolveRelColor(c);
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.topoChildCard}
                    onClick={() => onEntityClick(c.publicId)}
                  >
                    <span className={styles.topoCardBar} style={{ background: cc }} />
                    <div className={styles.topoChildHead}>
                      <TypeBadge color={cc} name={cs?.name} icon={cs?.icon} size={14} />
                      <span className={styles.topoCardName}>{c.entityName}</span>
                    </div>
                    <div className={styles.topoChildMeta}>
                      {cs && <Chip tone="ghost">{cs.name}</Chip>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          !isEmpty && (
            <div className={`${styles.topoEntityEmpty} ${sharedStyles.dim}`}>
              No contained entities
            </div>
          )
        )}
      </div>

      {(usedByRefs.length > 0 || consumesRefs.length > 0) && (
        <div className={styles.topoRefsGrid}>
          <div className={`${styles.topoRefsCol} ${styles.topoRefsColIn}`}>
            {usedByRefs.length === 0 && (
              <div className={`${styles.topoRefsEmpty} ${sharedStyles.dim}`}>
                No incoming references
              </div>
            )}
            {groupRelationsByField(usedByRefs).map(group => (
              <div key={group.key} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>{group.label}</div>
                {group.relations.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`in-${group.key}-${i}`) as React.Ref<HTMLButtonElement>}
                      className={styles.topoRefCard}
                      onClick={() => onEntityClick(r.publicId)}
                    >
                      <span className={styles.topoCardBar} style={{ background: rc }} />
                      <TypeBadge color={rc} name={rs?.name} icon={rs?.icon} size={14} />
                      <div className={styles.topoRefBody}>
                        <div className={styles.topoCardName}>{r.entityName}</div>
                        {rs && (
                          <div className={`${styles.topoRefKind} ${sharedStyles.dim}`}>
                            {rs.name}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className={`${styles.topoRefsCol} ${styles.topoRefsColOut}`}>
            {consumesRefs.length === 0 && (
              <div className={`${styles.topoRefsEmpty} ${sharedStyles.dim}`}>
                No outgoing references
              </div>
            )}
            {groupRelationsByField(consumesRefs).map(group => (
              <div key={group.key} className={styles.topoRefGroup}>
                <div className={styles.topoAxisLabel}>{group.label}</div>
                {group.relations.map((r, i) => {
                  const { schema: rs, color: rc } = resolveRelColor(r);
                  return (
                    <button
                      key={i}
                      type="button"
                      ref={setCardRef(`out-${group.key}-${i}`) as React.Ref<HTMLButtonElement>}
                      className={styles.topoRefCard}
                      onClick={() => onEntityClick(r.publicId)}
                    >
                      <span className={styles.topoCardBar} style={{ background: rc }} />
                      <TypeBadge color={rc} name={rs?.name} icon={rs?.icon} size={14} />
                      <div className={styles.topoRefBody}>
                        <div className={styles.topoCardName}>{r.entityName}</div>
                        {rs && (
                          <div className={`${styles.topoRefKind} ${sharedStyles.dim}`}>
                            {rs.name}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <EmptyState
          title="No relationships defined"
          subtitle="Add reference or containment fields to see the topology."
        />
      )}
    </div>
  );
};
