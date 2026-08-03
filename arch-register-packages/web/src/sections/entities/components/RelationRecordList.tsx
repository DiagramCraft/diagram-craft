import { useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  RelationField,
  RelationSchema
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { RelationAuditLogDialog } from '../../../dialogs/RelationAuditLogDialog';
import styles from './EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import overviewStyles from './EntityOverviewTab.module.css';

export const KEY_FIELD_COUNT = 3;

export const formatRelationFieldValue = (field: RelationField, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export type RelationDirection = 'outgoing' | 'incoming';

export const RelationRecordCard = ({
  record,
  direction,
  relationSchema,
  expanded,
  onToggleExpand,
  onViewHistory
}: {
  record: RelationRecord;
  direction: RelationDirection;
  relationSchema: RelationSchema | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onViewHistory: () => void;
}) => {
  const otherEndpoint = direction === 'outgoing' ? record._out : record._in;
  const activeFields = (relationSchema?.fields ?? []).filter(f => !f.archived);
  const fieldSummaries = activeFields
    .slice(0, KEY_FIELD_COUNT)
    .map(f => {
      const formatted = formatRelationFieldValue(f, record[f.id]);
      return formatted !== null ? `${f.name}: ${formatted}` : null;
    })
    .filter((v): v is string => v !== null);

  return (
    <div
      style={{
        marginBottom: 6,
        border: '1px solid var(--panel-border)',
        borderRadius: 4,
        padding: 8,
        background: 'var(--base-bg)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Not `styles.relation` (own border/background — would look like a nested card) and
            not a <button> (the entity name inside is a real navigation link, which can't
            legally nest inside one). Clicking anywhere but the link toggles expand. */}
        {/* biome-ignore lint/a11y/useSemanticElements: nested entity link can't sit inside a <button> */}
        <div
          role="button"
          tabIndex={0}
          style={{ flex: 1, cursor: 'pointer' }}
          onClick={onToggleExpand}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <span className={styles.relationLead}>
            <TbChevronRight
              size={10}
              className={sharedStyles.dim}
              style={{
                transform: expanded ? 'rotate(90deg)' : undefined,
                transition: 'transform 0.1s ease'
              }}
            />
            <EntityNavigationLink
              publicId={otherEndpoint.id}
              className={styles.relationName}
              onClick={event => event.stopPropagation()}
            >
              {otherEndpoint.name}
            </EntityNavigationLink>
            {!expanded && fieldSummaries.length > 0 && (
              <span className={sharedStyles.dim}> {fieldSummaries.join(' · ')}</span>
            )}
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '8px 10px 4px 16px' }}>
          {activeFields.map(f => (
            <div key={f.id} className={overviewStyles.propRow} style={{ alignItems: 'center' }}>
              <div className={overviewStyles.propLabel}>{f.name}</div>
              <div className={overviewStyles.propValue}>
                {formatRelationFieldValue(f, record[f.id]) ?? (
                  <span className={sharedStyles.dim}>—</span>
                )}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onViewHistory} style={{ marginTop: 8 }}>
              View history
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const RelationRecordList = ({
  records,
  direction,
  relationSchema,
  workspaceId
}: {
  records: RelationRecord[];
  direction: RelationDirection;
  relationSchema: RelationSchema | undefined;
  workspaceId: string;
}) => {
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [historyRecord, setHistoryRecord] = useState<RelationRecord | null>(null);

  if (records.length === 0) return null;

  return (
    <div style={{ width: '100%' }}>
      {records.map(record => (
        <RelationRecordCard
          key={record._uid}
          record={record}
          direction={direction}
          relationSchema={relationSchema}
          expanded={expandedUid === record._uid}
          onToggleExpand={() => setExpandedUid(expandedUid === record._uid ? null : record._uid)}
          onViewHistory={() => setHistoryRecord(record)}
        />
      ))}
      <RelationAuditLogDialog
        open={historyRecord !== null}
        onClose={() => setHistoryRecord(null)}
        workspaceId={workspaceId}
        relation={historyRecord}
      />
    </div>
  );
};
