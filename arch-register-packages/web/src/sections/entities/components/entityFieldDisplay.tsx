import type { ReactNode } from 'react';
import { Chip } from '../../../components/Chip';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { relationIds } from '../../../lib/entityEditState';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RefLookup } from '../types/entityDetailTypes';
import { resolveEntityReference } from '../entityDetailHelpers';
import { RelationRecordList } from './RelationRecordList';
import sharedStyles from '../EntityDetailScreen.module.css';
import styles from './EntityOverviewTab.module.css';

type ReferenceField = Extract<
  EntitySchema['fields'][number],
  { type: 'reference' | 'containment' }
>;
type TypedRelationField = Extract<EntitySchema['fields'][number], { type: 'typedRelation' }>;
type SelectOption = { value: string; label: string };

export const asPrincipal = (value: unknown): { principal_type?: string; principal_id?: string } =>
  (typeof value === 'object' && value !== null ? value : {}) as {
    principal_type?: string;
    principal_id?: string;
  };

export type RenderReferenceLink = (opts: {
  id: string;
  ref: EntitySummary | undefined;
  fieldId: string;
}) => ReactNode;

const defaultRenderReferenceLink: RenderReferenceLink = ({ id, ref }) => (
  <EntityNavigationLink publicId={ref?._publicId ?? id} className={styles.propLink}>
    {ref?._name ?? ref?._slug ?? id}
  </EntityNavigationLink>
);

export type RenderTypedRelationList = (opts: {
  records: RelationRecord[];
  direction: 'outgoing' | 'incoming';
  relationSchema: RelationSchema | undefined;
  workspaceId: string;
}) => ReactNode;

const defaultRenderTypedRelationList: RenderTypedRelationList = ({
  records,
  direction,
  relationSchema,
  workspaceId
}) => (
  <RelationRecordList
    records={records}
    direction={direction}
    relationSchema={relationSchema}
    workspaceId={workspaceId}
  />
);

/**
 * Dependencies needed to turn a schema field's raw value into a display `ReactNode`. Only
 * `renderReferenceLink` and `renderTypedRelationList` are call-site concerns (link click
 * interception, relation-card layout) — everything else is pure formatting shared by every caller.
 */
export type EntityFieldDisplayDeps = {
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
  workspaceSlug: string;
  formatDateValue: (value: unknown) => string;
  resolvePrincipalLabel: (value: {
    principal_type?: string;
    principal_id?: string;
  }) => string | undefined;
  renderReferenceLink?: RenderReferenceLink;
  renderTypedRelationList?: RenderTypedRelationList;
  /** Whether select/derived-select values render as `Chip`s (overview) or plain text (drawer). */
  asChip: boolean;
};

const formatSelectOption = (
  options: SelectOption[] | undefined,
  matchValue: unknown,
  asChip: boolean
): ReactNode => {
  const option = (options ?? []).find(candidate => candidate.value === matchValue);
  const label = option?.label ?? String(matchValue);
  return asChip ? <Chip tone="ghost">{label}</Chip> : <span>{label}</span>;
};

const formatMultiSelectOptions = (
  options: SelectOption[],
  values: unknown[],
  asChip: boolean
): ReactNode => {
  if (!asChip) {
    return (
      <span>
        {values.map(item => options.find(o => o.value === item)?.label ?? item).join(', ')}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {values.map((item, index) => {
        const option = options.find(candidate => candidate.value === item);
        return (
          <Chip key={`${String(item)}-${index}`} tone="ghost">
            {option?.label ?? String(item)}
          </Chip>
        );
      })}
    </span>
  );
};

const formatPrincipalDisplayValue = (
  value: unknown,
  resolvePrincipalLabel: EntityFieldDisplayDeps['resolvePrincipalLabel']
): ReactNode => {
  const principal = asPrincipal(value);
  if (!principal.principal_id) return <span className={sharedStyles.dim}>—</span>;
  return <Chip tone="ghost">{resolvePrincipalLabel(principal) ?? principal.principal_id}</Chip>;
};

const formatReferenceDisplayValue = (
  field: ReferenceField,
  value: unknown,
  deps: Pick<EntityFieldDisplayDeps, 'refLookup' | 'referenceOptions'> & {
    renderLink: RenderReferenceLink;
  }
): ReactNode => {
  const ids = relationIds(value);
  if (ids.length === 0) return <span className={sharedStyles.dim}>—</span>;
  return (
    <>
      {ids.map((id, index) => {
        const ref = resolveEntityReference(
          id,
          field.schemaId,
          deps.refLookup,
          deps.referenceOptions
        );
        return (
          <span key={id}>
            {index > 0 && ', '}
            {deps.renderLink({ id: ref?._publicId ?? id, ref, fieldId: field.id })}
          </span>
        );
      })}
    </>
  );
};

const formatTypedRelationDisplayValue = (
  field: TypedRelationField,
  deps: Pick<
    EntityFieldDisplayDeps,
    'typedRelationsOutgoing' | 'typedRelationsIncoming' | 'relationSchemas' | 'workspaceSlug'
  > & { renderList: RenderTypedRelationList }
): ReactNode => {
  const direction = field.direction === 'in' ? 'outgoing' : 'incoming';
  const records = (
    field.direction === 'in' ? deps.typedRelationsOutgoing : deps.typedRelationsIncoming
  ).filter(record => record._schema.id === field.relationSchemaId);
  if (records.length === 0) return <span className={sharedStyles.dim}>—</span>;
  return deps.renderList({
    records,
    direction,
    relationSchema: deps.relationSchemas.find(rs => rs.id === field.relationSchemaId),
    workspaceId: deps.workspaceSlug
  });
};

const formatMultiValueDisplay = (
  field: EntitySchema['fields'][number],
  value: unknown[],
  deps: Pick<EntityFieldDisplayDeps, 'formatDateValue' | 'resolvePrincipalLabel' | 'asChip'>
): ReactNode => {
  if (value.length === 0) return <span className={sharedStyles.dim}>—</span>;
  if (field.type === 'select') return formatMultiSelectOptions(field.options, value, deps.asChip);
  if (field.type === 'boolean')
    return <span>{value.map(item => (item ? 'Yes' : 'No')).join(', ')}</span>;
  if (field.type === 'date')
    return <span>{value.map(item => deps.formatDateValue(item)).join(', ')}</span>;
  if (field.type === 'currency')
    return <span>{value.map(item => formatCurrencyValue(item)).join(', ')}</span>;
  if (field.type === 'principal') {
    return (
      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
        {value.map((item, index) => (
          <span key={index}>{formatPrincipalDisplayValue(item, deps.resolvePrincipalLabel)}</span>
        ))}
      </span>
    );
  }
  return <span>{value.map(item => String(item)).join(', ')}</span>;
};

/**
 * Turns a schema field + its raw value into a display `ReactNode`. Shared by `PropertyRow`
 * (overview, `asChip: true`) and `DrawerPropertyRow` (drawer, `asChip: false`) — the only
 * difference between the two callers is `asChip` and how reference links / typed-relation lists
 * are rendered (both injectable, defaulting to the overview's plain behavior).
 */
export const renderEntityFieldDisplayValue = (
  field: EntitySchema['fields'][number],
  value: unknown,
  deps: EntityFieldDisplayDeps
): ReactNode => {
  const {
    refLookup,
    referenceOptions,
    formatDateValue,
    resolvePrincipalLabel,
    renderReferenceLink = defaultRenderReferenceLink,
    renderTypedRelationList = defaultRenderTypedRelationList,
    asChip
  } = deps;

  if (field.type === 'typedRelation') {
    return formatTypedRelationDisplayValue(field, { ...deps, renderList: renderTypedRelationList });
  }
  if (field.type === 'reference' || field.type === 'containment') {
    return formatReferenceDisplayValue(field, value, {
      refLookup,
      referenceOptions,
      renderLink: renderReferenceLink
    });
  }
  if (Array.isArray(value)) {
    return formatMultiValueDisplay(field, value, {
      formatDateValue,
      resolvePrincipalLabel,
      asChip
    });
  }
  if (value == null || value === '') return <span className={sharedStyles.dim}>—</span>;
  if (field.type === 'principal') return formatPrincipalDisplayValue(value, resolvePrincipalLabel);
  if (field.type === 'derived') {
    if (field.resultType === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
    if (field.resultType === 'currency') return <span>{formatCurrencyValue(value)}</span>;
    if (field.resultType === 'select')
      return formatSelectOption(field.options, String(value), asChip);
    return <span>{String(value)}</span>;
  }
  if (field.type === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (field.type === 'select') return formatSelectOption(field.options, value, asChip);
  if (field.type === 'date') return <span>{formatDateValue(value)}</span>;
  if (field.type === 'currency') return <span>{formatCurrencyValue(value)}</span>;
  return <span>{String(value)}</span>;
};
