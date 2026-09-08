import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { entityDetailQuery, entitiesQuery } from '../../../queries/entities';
import { entityTypedRelationsQuery } from '../../../queries/relations';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { useCapabilityRollup } from '../useCapabilityRollup';
import type { StrategyModelConfig } from '../strategyQueries';
import styles from './CapabilityDrawer.module.css';

const SUPPORTED_ENTITIES_RELATION = 'business-capability-supports-entity';
const SUPPORTING_OBJECTIVES_RELATION = 'objective-supports-business-capability';

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
  const capability = useQuery(entityDetailQuery(workspaceSlug, capabilityId));
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const rollup = useCapabilityRollup(
    workspaceSlug,
    strategyConfig.businessCapabilitySchemaId,
    capabilityId
  );
  const children = useQuery(
    entitiesQuery(
      workspaceSlug,
      {
        schemaId: strategyConfig.businessCapabilitySchemaId,
        view: 'summary',
        conditions: [{ fieldId: 'parent', op: 'equals', value: capabilityId }]
      },
      true
    )
  );
  const relations = useQuery(entityTypedRelationsQuery(workspaceSlug, capabilityId));

  // The capability is the "in" endpoint of `business-capability-supports-entity`, so its links
  // surface in `outgoing`; it's the "out" endpoint of `objective-supports-business-capability`,
  // so its links surface in `incoming`. See `entityTypedRelationsSchema` in relationContract.ts.
  const realizedBy = useMemo(
    () =>
      (relations.data?.outgoing ?? []).filter(r => r._schema.id === SUPPORTED_ENTITIES_RELATION),
    [relations.data]
  );
  const supportingObjectives = useMemo(
    () =>
      (relations.data?.incoming ?? []).filter(r => r._schema.id === SUPPORTING_OBJECTIVES_RELATION),
    [relations.data]
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
        <span>{children.data?.items.length ?? 0}</span>
      </div>

      <div className={styles.sectionLabel}>Children</div>
      {children.isLoading ? (
        <span className="dim">Loading…</span>
      ) : (children.data?.items.length ?? 0) > 0 ? (
        <div className={styles.tags}>
          {children.data!.items.map(child => (
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
