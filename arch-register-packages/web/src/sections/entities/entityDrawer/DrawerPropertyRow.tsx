import { usePrincipalLabel } from '../../../hooks/usePrincipalLabel';
import { formatDate } from '../../../utils/dateFormat';
import { relationIds } from '../../../lib/entityEditState';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { ExternalMetadataIndicator } from '../../../components/ExternalMetadataIndicator';
import {
  formatRelationFieldValue,
  renderEntityRelationFieldValue
} from '../components/RelationRecordList';
import { renderEntityFieldDisplayValue } from '../components/entityFieldDisplay';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { ExternalMetadataResult } from '@arch-register/api-types/common';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RefLookup } from '../types/entityDetailTypes';
import relationStyles from '../components/EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import styles from './EntityDrawer.module.css';

// A single typed-relation card in a drawer mini-panel: always expanded, no chevron, no "View
// history" affordance — the interaction model is deliberately simpler than the overview's
// `RelationRecordCard` (which supports collapse and an audit-log dialog), so this stays a small,
// separate, read-only component rather than another toggle on that one.
const DrawerRelationRecordCard = ({
  record,
  direction,
  relationSchema,
  workspaceId
}: {
  record: RelationRecord;
  direction: 'outgoing' | 'incoming';
  relationSchema: RelationSchema | undefined;
  workspaceId: string;
}) => {
  const otherEndpoint = direction === 'outgoing' ? record._out : record._in;
  const activeFields = (relationSchema?.fields ?? []).filter(field => !field.archived);
  const entityRelationIds = activeFields
    .filter(field => field.type === 'entityRelation')
    .flatMap(field => relationIds(record[field.id]));
  const refLookup = useEntitiesByIds(workspaceId, entityRelationIds);

  return (
    <div style={{ marginBottom: 0, borderRadius: 6, padding: 8 }}>
      <EntityNavigationLink publicId={otherEndpoint.id} className={relationStyles.relationName}>
        {otherEndpoint.name}
      </EntityNavigationLink>
      <div style={{ padding: '2px 0 0 0' }}>
        {activeFields.map(field => (
          <div key={field.id} className={styles.relationFieldRow}>
            <div className={styles.metadataLabel}>{field.name}</div>
            <div className={styles.relationFieldValue}>
              {field.type === 'entityRelation'
                ? (renderEntityRelationFieldValue(record[field.id], refLookup) ?? (
                    <span className={sharedStyles.dim}>—</span>
                  ))
                : (formatRelationFieldValue(field, record[field.id]) ?? (
                    <span className={sharedStyles.dim}>—</span>
                  ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DrawerRelationRecordList = ({
  records,
  direction,
  relationSchema,
  workspaceId
}: {
  records: RelationRecord[];
  direction: 'outgoing' | 'incoming';
  relationSchema: RelationSchema | undefined;
  workspaceId: string;
}) => (
  <>
    {records.map(record => (
      <DrawerRelationRecordCard
        key={record._uid}
        record={record}
        direction={direction}
        relationSchema={relationSchema}
        workspaceId={workspaceId}
      />
    ))}
  </>
);

/**
 * Renders one resolved drawer field item, read-only. Kept separate from the overview's
 * `PropertyRow` (which also handles editing) so the drawer's own presentation (no type/optional
 * badges, always-expanded relation cards, plain-text selects) doesn't leak `displayVariant`-style
 * toggles back into the shared overview component. Value formatting itself is shared via
 * `renderEntityFieldDisplayValue`.
 */
export const DrawerPropertyRow = ({
  field,
  label,
  value,
  presentation,
  refLookup,
  referenceOptions,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas,
  workspaceSlug,
  formatDateValue = formatDate,
  onOpenRelatedEntity,
  externalMeta
}: {
  field: EntitySchema['fields'][number];
  label?: string;
  value: unknown;
  presentation: 'row' | 'mini-panel';
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
  workspaceSlug: string;
  formatDateValue?: (value: unknown) => string;
  onOpenRelatedEntity?: (fieldId: string, publicId: string) => boolean;
  externalMeta?: ExternalMetadataResult;
}) => {
  const resolvePrincipalLabel = usePrincipalLabel();
  const isExternal = field.external_kind !== undefined;
  const isMiniPanelRelation = presentation === 'mini-panel' && field.type === 'typedRelation';

  const display = renderEntityFieldDisplayValue(field, value, {
    refLookup,
    referenceOptions,
    typedRelationsOutgoing,
    typedRelationsIncoming,
    relationSchemas,
    workspaceSlug,
    formatDateValue,
    resolvePrincipalLabel,
    asChip: false,
    renderReferenceLink: ({ id, ref, fieldId }) => (
      <EntityNavigationLink
        publicId={id}
        onClick={event => {
          if (onOpenRelatedEntity?.(fieldId, id)) event.preventDefault();
        }}
      >
        {ref?._name ?? ref?._slug ?? id}
      </EntityNavigationLink>
    ),
    renderTypedRelationList: ({ records, direction, relationSchema, workspaceId }) => (
      <DrawerRelationRecordList
        records={records}
        direction={direction}
        relationSchema={relationSchema}
        workspaceId={workspaceId}
      />
    )
  });

  const rowClass = isMiniPanelRelation
    ? styles.relationRow
    : presentation === 'mini-panel'
      ? styles.statRow
      : styles.metadataRow;
  const labelClass = isMiniPanelRelation
    ? `${styles.metadataLabel} ${styles.relationRowLabel}`
    : presentation === 'mini-panel'
      ? styles.statLabel
      : styles.metadataLabel;
  const valueClass =
    presentation === 'mini-panel' && !isMiniPanelRelation ? styles.statValue : styles.metadataValue;

  return (
    <div className={rowClass}>
      <span className={labelClass}>{label ?? field.name}</span>
      <span className={valueClass}>
        {display}
        {isExternal && (
          <ExternalMetadataIndicator kind={field.external_kind!} result={externalMeta} />
        )}
      </span>
    </div>
  );
};
