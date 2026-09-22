import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext
} from '../EntityDrawerProviderRegistry';
import { useEntityRollupMetric } from './useEntityRollupMetric';
import { useEntityRollupLeafCount } from './useEntityRollupLeafCount';
import { formatRollupValue } from './formatRollupValue';
import styles from '../EntityDrawer.module.css';

/**
 * Renders a generic drawer `rollup` item: the configured field/aggregation/format aggregated over
 * the entity's own recursive `parent`-containment subtree. Unlike a `slot` item, this needs no
 * per-capability provider — the metric engine is schema-agnostic, so any schema with a `parent`
 * containment field can use it directly.
 */
export const RollupStatItem = ({
  item,
  label,
  entity,
  context
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup' }>;
  label: string;
  entity: EntityRecord;
  context: EntityDrawerProviderContext;
}) => {
  const result = useEntityRollupMetric(
    context.workspaceId,
    context.schema.id,
    entity._uid,
    item.fieldId,
    item.aggregation,
    entity
  );
  const state = result.isLoading ? 'loading' : result.error ? 'unavailable' : 'ready';

  return (
    <div className={styles.statRow}>
      {item.showLabel !== false && <span className={styles.statLabel}>{label}</span>}
      <span className={styles.statValue}>
        <EntityDrawerProviderStatus state={state} unavailableMessage="Roll-up is unavailable.">
          {formatRollupValue(result.value, item.format, result.currency)}
        </EntityDrawerProviderStatus>
      </span>
    </div>
  );
};

/** Renders a standalone `rollup-leaf-count` item: the count of descendant entities with no
 *  containment children of their own, over the same subtree a `rollup` item would aggregate. */
export const RollupLeafCountItem = ({
  item,
  label,
  entity,
  context
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup-leaf-count' }>;
  label: string;
  entity: EntityRecord;
  context: EntityDrawerProviderContext;
}) => {
  const placeholderFieldId = context.schema.fields[0]?.id ?? entity._uid;
  const result = useEntityRollupLeafCount(
    context.workspaceId,
    context.schema.id,
    entity._uid,
    placeholderFieldId
  );
  const state = result.isLoading ? 'loading' : result.error ? 'unavailable' : 'ready';

  return (
    <div className={styles.statRow}>
      {item.showLabel !== false && <span className={styles.statLabel}>{label}</span>}
      <span className={styles.statValue}>
        <EntityDrawerProviderStatus state={state} unavailableMessage="Leaf count is unavailable.">
          {result.leafCount ?? '—'}
        </EntityDrawerProviderStatus>
      </span>
    </div>
  );
};
