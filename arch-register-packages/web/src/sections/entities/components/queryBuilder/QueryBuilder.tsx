import { useMemo } from 'react';
import { TbAlertTriangle } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { getEntityFilterFieldDefs } from '../../../../components/FilterBuilder';
import { getRelationFilterFieldDefs } from '../../../relations/RelationFilterBuilder';
import { SearchInput } from '../../../../components/SearchInput';
import { addFreeTextQuery, getFreeTextQuery } from '../entityBrowserState';
import {
  countHops,
  exceedsHopBudget,
  MAX_PATH_HOPS,
  toEditableRoot
} from './queryBuilderState';
import { QueryGroup } from './QueryTree';
import styles from './queryBuilder.module.css';

const ANY_TYPE = '__any_type__';

export type QueryBuilderProps = {
  query: EntityQuery;
  onChange: (query: EntityQuery) => void;
  /** 'entity' today; 'relation' is accepted so the Relations browser can adopt the same component
   *  once relation-context path steps land (#2354, plan phase 7). */
  rootKind?: 'entity' | 'relation';
  schemas: EntitySchema[];
  relationSchemas?: RelationSchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  joinedAssessment?: Assessment | null;
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  /** Canonical text rendering of `query`, supplied by the wiring layer (it owns the workspace id
   *  and the debounced `printText` call). `undefined` hides the preview line. */
  textPreview?: string;
  /** When the builder is embedded next to an external search box that already owns the live
   *  free-text query (the entity browser toolbar), hide the built-in one to avoid two inputs
   *  fighting over the same clause. Defaults to shown. */
  showFreeText?: boolean;
  onClose?: () => void;
};

/**
 * The progressive visual query builder (#2354). Opens as a flat list of conditions and grows in
 * place into `Any`/`All` groups and negation. Reads and writes the `EntityQuery` IR directly, so
 * it is full-fidelity with Advanced text mode - no lossy conversion between them.
 *
 * This phase covers the boolean tree over flat predicates plus the free-text clause and a Type
 * scope; relation traversal, same-instance scoped filters, and projection columns are added in
 * later phases and currently render as read-only summaries.
 */
export const QueryBuilder = ({
  query,
  onChange,
  rootKind = 'entity',
  schemas,
  relationSchemas = [],
  lifecycleStates,
  owners,
  enums,
  joinedAssessment,
  getFieldGroupAccess = () => 'edit',
  textPreview,
  showFreeText = true
}: QueryBuilderProps) => {
  const editable = useMemo(() => toEditableRoot(query), [query]);
  const freeText = getFreeTextQuery(query);
  const isRelation = rootKind === 'relation';

  const leafCtx = useMemo(
    () => ({
      rootKind,
      schemas,
      relationSchemas,
      enums,
      lifecycleStates,
      owners,
      joinedAssessment,
      getFieldGroupAccess,
      rootSchemaScope: query.schemaId ? [query.schemaId] : ('any' as const),
      atHopLimit: countHops(query) >= MAX_PATH_HOPS
    }),
    [
      rootKind,
      schemas,
      relationSchemas,
      enums,
      lifecycleStates,
      owners,
      joinedAssessment,
      getFieldGroupAccess,
      query
    ]
  );

  const fields = useMemo(
    () =>
      isRelation
        ? getRelationFilterFieldDefs({
            relationSchemas,
            entitySchemas: schemas,
            enums,
            owners,
            lifecycleStates,
            getFieldGroupAccess
          })
        : getEntityFilterFieldDefs({
            schemas,
            lifecycleStates,
            owners,
            enums,
            selectedSchemaId: query.schemaId ?? null,
            joinedAssessment,
            getFieldGroupAccess
          }),
    [
      isRelation,
      schemas,
      relationSchemas,
      lifecycleStates,
      owners,
      enums,
      query.schemaId,
      joinedAssessment,
      getFieldGroupAccess
    ]
  );

  // Structural edits are applied exactly as issued - removing a node removes only that node. An
  // emptied group is left in place (it renders with a "No conditions" placeholder and its own
  // remove button) rather than being auto-pruned, which previously cascade-deleted an outer group
  // whose only child was the group just removed.
  const emit = (nextRoot: EntityQuery['root']) => onChange({ ...editable, root: nextRoot });

  const overBudget = exceedsHopBudget(query);

  return (
    <div className={styles.container}>
      {/* The Relations browser has no schema picker (Type is just a `_schemaId` condition) and no
          free-text-searchable fields, so its builder skips the whole top bar. */}
      {!isRelation && (
        <div className={styles.topBar}>
          <label className={styles.typeLabel}>
            Type
            <div className={styles.typeSelect}>
              <Select.Root
                value={query.schemaId ?? ANY_TYPE}
                placeholder="Any type"
                onChange={value =>
                  onChange({ ...query, schemaId: !value || value === ANY_TYPE ? undefined : value })
                }
              >
                <Select.Item value={ANY_TYPE}>Any type</Select.Item>
                {schemas.map(schema => (
                  <Select.Item key={schema.id} value={schema.id}>
                    {schema.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          </label>
          {showFreeText && (
            <SearchInput
              size="sm"
              className={styles.freeText}
              placeholder="Search text…"
              value={freeText}
              onChange={value => onChange(addFreeTextQuery(query, value))}
              onClear={() => onChange(addFreeTextQuery(query, ''))}
            />
          )}
        </div>
      )}

      <QueryGroup
        root={editable.root}
        path={[]}
        onRootChange={emit}
        fields={fields}
        leafCtx={leafCtx}
      />

      {overBudget && (
        <div className={styles.warn}>
          <TbAlertTriangle size={12} />
          <span>
            This query traverses {countHops(query)} relation hops; the limit is {MAX_PATH_HOPS}.
          </span>
        </div>
      )}

      {textPreview !== undefined && (
        <div className={styles.preview} title={textPreview}>
          <span className={styles.previewLabel}>Query</span>
          <code className={styles.previewText}>{textPreview || '(empty)'}</code>
        </div>
      )}
    </div>
  );
};
