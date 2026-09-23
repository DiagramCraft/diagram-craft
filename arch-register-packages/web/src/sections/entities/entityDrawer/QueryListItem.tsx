import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Chip } from '../../../components/Chip';
import { EntityDrawerProviderStatus } from './EntityDrawerProviderRegistry';
import { useEntityDrawerQueryItem } from './useEntityDrawerQueryItem';
import styles from './EntityDrawer.module.css';

/**
 * Renders a generic `query` drawer item: the flat, deduplicated set of entities matched by the
 * item's path expression (specs/QUERY_LANGUAGE.md §4), scoped to the current entity as root. Unlike
 * `typed-relation-list`, this can traverse recursive containment (`subtree(...)`) as well as typed
 * relations, so it covers cases like "entities linked directly to this capability or to any of its
 * descendants" without a bespoke provider.
 */
export const QueryListItem = ({
  item,
  label,
  workspaceId,
  schemaName,
  entityId
}: {
  item: Extract<EntityDrawerItem, { kind: 'query' }>;
  label: string;
  workspaceId: string;
  schemaName: string;
  entityId: string;
}) => {
  const result = useEntityDrawerQueryItem(workspaceId, schemaName, entityId, item.queryText);

  const state = result.isLoading ? 'loading' : result.error ? 'unavailable' : result.items.length > 0 ? 'ready' : 'empty';

  return (
    <EntityDrawerProviderStatus
      state={state}
      emptyMessage={`No ${label.toLowerCase()} linked.`}
      unavailableMessage={`${label} is unavailable.`}
    >
      <div className={styles.tags}>
        {result.items.map((entity: EntityRecord) => (
          <Chip key={entity._uid} tone="ghost">
            {entity._name}
          </Chip>
        ))}
      </div>
    </EntityDrawerProviderStatus>
  );
};
