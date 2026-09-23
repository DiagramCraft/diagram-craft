import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { formatDate } from '../../../utils/dateFormat';
import { renderEntityFieldDisplayValue } from '../components/entityFieldDisplay';
import type { RefLookup } from '../types/entityDetailTypes';
import { EntityDrawerProviderStatus } from './EntityDrawerProviderRegistry';
import { useEntityDrawerQueryItem } from './useEntityDrawerQueryItem';
import styles from './EntityDrawer.module.css';

const QueryListFields = ({
  entity,
  schema,
  fields,
  workspaceSlug,
  lifecycleStates
}: {
  entity: EntityRecord;
  schema: EntitySchema | undefined;
  fields: NonNullable<Extract<EntityDrawerItem, { kind: 'query' }>['fields']>;
  workspaceSlug: string;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const refLookup: RefLookup = new Map();

  return (
    <div className={styles.queryFields}>
      {fields.flatMap(configuredField => {
        if (configuredField.fieldId === '_lifecycle') {
          if (!entity._lifecycle) return [];
          return [
            <div className={styles.queryField} key={configuredField.fieldId}>
              <span className={styles.queryFieldLabel}>
                {configuredField.label ?? 'Lifecycle'}
              </span>
              <span className={styles.queryFieldValue}>
                <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
              </span>
            </div>
          ];
        }
        const field = schema?.fields.find(candidate => candidate.id === configuredField.fieldId);
        if (!field) return [];
        return [
          <div className={styles.queryField} key={configuredField.fieldId}>
            <span className={styles.queryFieldLabel}>{configuredField.label ?? field.name}</span>
            <span className={styles.queryFieldValue}>
              {renderEntityFieldDisplayValue(field, entity[field.id], {
                refLookup,
                referenceOptions: {},
                typedRelationsOutgoing: [],
                typedRelationsIncoming: [],
                relationSchemas: [],
                workspaceSlug,
                formatDateValue: formatDate,
                resolvePrincipalLabel: value => value.principal_id,
                asChip: false
              })}
            </span>
          </div>
        ];
      })}
    </div>
  );
};

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
  entityId,
  schemas,
  lifecycleStates = []
}: {
  item: Extract<EntityDrawerItem, { kind: 'query' }>;
  label: string;
  workspaceId: string;
  schemaName: string;
  entityId: string;
  schemas: EntitySchema[];
  lifecycleStates?: WorkspaceLifecycleState[];
}) => {
  const result = useEntityDrawerQueryItem(workspaceId, schemaName, entityId, item.queryText);
  const presentation = item.presentation ?? 'chips';

  const state = result.isLoading
    ? 'loading'
    : result.error
      ? 'unavailable'
      : result.items.length > 0
        ? 'ready'
        : 'empty';

  return (
    <EntityDrawerProviderStatus
      state={state}
      emptyMessage={`No ${label.toLowerCase()} linked.`}
      unavailableMessage={`${label} is unavailable.`}
    >
      {presentation === 'chips' ? (
        <div className={styles.tags}>
          {result.items.map((entity: EntityRecord) => (
            <Chip key={entity._uid} tone="ghost">
              {entity._name}
            </Chip>
          ))}
        </div>
      ) : (
        <div className={styles.queryList}>
          {result.items.map((entity: EntityRecord) => (
            <div className={styles.queryRow} key={entity._uid}>
              <div className={styles.queryName}>{entity._name}</div>
              <QueryListFields
                entity={entity}
                schema={schemas.find(schema => schema.id === entity._schema.id)}
                fields={item.fields ?? []}
                workspaceSlug={workspaceId}
                lifecycleStates={lifecycleStates}
              />
            </div>
          ))}
        </div>
      )}
    </EntityDrawerProviderStatus>
  );
};
