import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useEntityTree } from '../../../hooks/useEntities';
import { entityDetailQuery, entitiesQuery } from '../../../queries/entities';
import { entityTypedRelationsQuery } from '../../../queries/relations';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { useCapabilityRollup } from '../useCapabilityRollup';
import { extractCapabilityOwnFields } from '../capabilityOwnFields';
import type { StrategyModelConfig } from '../strategyQueries';
import styles from './CapabilityDrawer.module.css';

const formatNumber = (value: number | null, digits = 1) =>
  value == null ? '—' : value.toFixed(digits);

/**
 * Slide-over showing one Business Capability's roll-up stats, attributes, children, "Realized
 * by" applications, and linked objectives/initiatives — mirrors
 * `../../business-glossary/sections/GlossaryTermDrawer.tsx`. Deep-linkable from both the
 * Capabilities list (`strategy/capabilities/$capabilityId`) and the Capability map
 * (`strategy/map/$capabilityId`).
 */
export const CapabilityDrawer = ({
  workspaceSlug,
  capabilityId,
  strategyConfig,
  onClose,
  onOpenCapability
}: {
  workspaceSlug: string;
  capabilityId: string;
  strategyConfig: StrategyModelConfig;
  onClose: () => void;
  /** Re-opens the drawer at a different capability id (e.g. clicking a child), staying on the
   *  current section's deep-link route. */
  onOpenCapability: (id: string) => void;
}) => {
  const navigate = useNavigate();
  // `capabilityId` (the route param) is the entity's *public* id (`openCapability` in
  // `StrategyCapabilitiesScreen`/`StrategyCapabilityMapScreen` passes `entity._publicId`, e.g.
  // "CAP-205") — `entities.get` resolves either public id or internal uid, but the metrics engine
  // (`boxEntityIds`) and `entities.tree`'s edges are keyed by internal uid only. Every lookup below
  // that isn't the initial detail fetch uses `uid`, resolved once the entity loads, not the raw
  // prop — using the public id there silently matched nothing (roll-up metrics always "no data",
  // tree edges never found, so children and leaf count looked wrong for every capability).
  const capability = useQuery(entityDetailQuery(workspaceSlug, capabilityId));
  const uid = capability.data?._uid ?? null;
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const rollup = useCapabilityRollup(
    workspaceSlug,
    strategyConfig.businessCapabilitySchemaId,
    uid,
    extractCapabilityOwnFields(capability.data)
  );
  // Not a `conditions: [{ fieldId: 'parent', op: 'equals', value: uid }]` entities query: `parent`
  // is a containment field, stored as a ref array even at `maxCount: 1`, and the entity-query
  // filter compiler only treats a field as array-shaped when `isMultiValuedScalarField` says so —
  // which excludes containment fields entirely, so an `equals` filter against `parent` compiles to
  // a scalar comparison that can never match and silently returns zero rows. `entities.tree`'s
  // `edges` are built via `decodeRefs` instead (`buildContainmentChildrenIndex` in
  // `metricDescendants.ts`), which handles the ref-array storage correctly — same tree data
  // `StrategySidebar`'s capability tree already relies on.
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: strategyConfig.businessCapabilitySchemaId },
    true
  );
  const children = useMemo(() => {
    const nodeById = new Map((tree.data?.nodes ?? []).map(node => [node._uid, node]));
    return (tree.data?.edges ?? [])
      .filter(edge => edge.parentId === uid)
      .map(edge => nodeById.get(edge.childId))
      .filter((node): node is NonNullable<typeof node> => node != null);
  }, [tree.data, uid]);
  const relations = useQuery(entityTypedRelationsQuery(workspaceSlug, uid ?? ''));

  // The capability is the "in" endpoint of `business-capability-supports-entity`, so its links
  // surface in `outgoing`; it's the "out" endpoint of `objective-supports-business-capability`,
  // so its links surface in `incoming`. See `entityTypedRelationsSchema` in relationContract.ts.
  // Filtered by the *real*, per-workspace relation schema id (`strategyConfig`, resolved from the
  // `strategy-model` capability configuration's `..._relation_schema` bindings) — the schema
  // template's own symId strings ('business-capability-supports-entity', etc.) don't match
  // `r._schema.id`, which is always a real id.
  const realizedBy = useMemo(
    () =>
      (relations.data?.outgoing ?? []).filter(
        r => r._schema.id === strategyConfig.businessCapabilitySupportsEntityRelationSchemaId
      ),
    [relations.data, strategyConfig.businessCapabilitySupportsEntityRelationSchemaId]
  );
  const supportingObjectives = useMemo(
    () =>
      (relations.data?.incoming ?? []).filter(
        r => r._schema.id === strategyConfig.objectiveSupportsBusinessCapabilityRelationSchemaId
      ),
    [relations.data, strategyConfig.objectiveSupportsBusinessCapabilityRelationSchemaId]
  );
  const objectiveIds = useMemo(
    () => [...new Set(supportingObjectives.map(r => r._in.id))],
    [supportingObjectives]
  );
  const initiatives = useQuery(
    entitiesQuery(
      workspaceSlug,
      {
        schemaId: strategyConfig.initiativeSchemaId,
        view: 'summary',
        conditions: [{ fieldId: 'objectives', op: 'in', value: objectiveIds }]
      },
      objectiveIds.length > 0
    )
  );

  if (capability.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading capability…</div>
      </Drawer>
    );
  }
  if (capability.isError || !capability.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This capability is unavailable.</div>
      </Drawer>
    );
  }

  const entity = capability.data;

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        <>
          {typeof entity.capability_level === 'string' && (
            <Chip tone="ghost">{entity.capability_level}</Chip>
          )}
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
        </>
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Roll-up</div>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg maturity</div>
          <div className={styles.statValue}>{formatNumber(rollup.avgMaturity)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg target</div>
          <div className={styles.statValue}>{formatNumber(rollup.avgMaturityTarget)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg gap</div>
          <div className={styles.statValue}>{formatNumber(rollup.avgGap)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg risk</div>
          <div className={styles.statValue}>{formatNumber(rollup.avgRisk)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Annual investment</div>
          <div className={styles.statValue}>
            {rollup.sumAnnualInvestment == null
              ? '—'
              : formatCurrencyValue({
                  amount: rollup.sumAnnualInvestment,
                  currency: rollup.investmentCurrencyCode
                })}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Leaf count</div>
          <div className={styles.statValue}>{rollup.leafCount ?? '—'}</div>
        </div>
      </div>

      <div className={styles.sectionLabel}>Attributes</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Type</span>
        <span>{entity._schema.name}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Level</span>
        <span>{typeof entity.capability_level === 'string' ? entity.capability_level : '—'}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{entity._owner?.name ?? <span className="dim">No owner assigned</span>}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Children</span>
        <span>{children.length}</span>
      </div>

      <div className={styles.sectionLabel}>Children</div>
      {tree.isLoading ? (
        <span className="dim">Loading…</span>
      ) : children.length > 0 ? (
        <div className={styles.tags}>
          {children.map(child => (
            <button
              key={child._uid}
              type="button"
              className={styles.childChip}
              onClick={() => onOpenCapability(child._uid)}
            >
              {child._name}
            </button>
          ))}
        </div>
      ) : (
        <span className="dim">No child capabilities.</span>
      )}

      <div className={styles.sectionLabel}>Realized by</div>
      {realizedBy.length > 0 ? (
        <div className={styles.tags}>
          {realizedBy.map(r => (
            <Chip key={r._uid} tone="ghost">
              {r._out.name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">
          No directly linked applications. Non-leaf capabilities may only show links carried by
          their descendants.
        </span>
      )}

      <div className={styles.sectionLabel}>Linked objectives</div>
      {supportingObjectives.length > 0 ? (
        <div className={styles.tags}>
          {supportingObjectives.map(r => (
            <Chip key={r._uid} tone="ghost">
              {r._in.name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No linked objectives.</span>
      )}

      <div className={styles.sectionLabel}>Linked initiatives</div>
      {objectiveIds.length === 0 ? (
        <span className="dim">No linked initiatives.</span>
      ) : initiatives.isLoading ? (
        <span className="dim">Loading…</span>
      ) : (initiatives.data?.items.length ?? 0) > 0 ? (
        <div className={styles.tags}>
          {initiatives.data!.items.map(initiative => (
            <Chip key={initiative._uid} tone="ghost">
              {initiative._name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No linked initiatives.</span>
      )}
    </Drawer>
  );
};
