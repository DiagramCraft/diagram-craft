import { useState } from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Button } from '@diagram-craft/app-components/Button';
import { useRelation } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { RelationAuditLogDialog } from '../../../dialogs/RelationAuditLogDialog';
import { formatRelationFieldValue } from './RelationRecordList';
import sharedStyles from '../EntityDetailScreen.module.css';
import overviewStyles from './EntityOverviewTab.module.css';
import styles from './RelationDetailPopover.module.css';

type Props = {
  workspaceId: string;
  relationId: string;
  x: number;
  y: number;
  onClose: () => void;
};

// Small popup shown when clicking a typed relation instance elsewhere in the UI (currently: the
// entity graph view; intended to be reused by topology/matrix/explore once they surface typed
// relations too). Shows the relation's endpoints, field values, and a "View history" action,
// without navigating away to a full page.
export const RelationDetailPopover = ({ workspaceId, relationId, x, y, onClose }: Props) => {
  const [showHistory, setShowHistory] = useState(false);
  const { data: record, isLoading } = useRelation(workspaceId, relationId);
  const { data: relationSchemas } = useRelationSchemas(workspaceId, !!relationId);
  const relationSchema = relationSchemas?.find(schema => schema.id === record?._schema.id);
  const activeFields = (relationSchema?.fields ?? []).filter(field => !field.archived);

  return (
    <>
      <Popover.Imperative x={x} y={y} onClose={onClose} className={styles.popover}>
        {isLoading || !record ? (
          <div className={sharedStyles.dim}>Loading…</div>
        ) : (
          <div className={styles.content}>
            <div className={styles.header}>
              {relationSchema?.color && (
                <span className={styles.colorDot} style={{ background: relationSchema.color }} />
              )}
              {relationSchema?.name ?? 'Relation'}
            </div>
            <div className={styles.endpoints}>
              <EntityNavigationLink publicId={record._in.id} onClick={() => onClose()}>
                {record._in.name}
              </EntityNavigationLink>
              <span className={sharedStyles.dim}>→</span>
              <EntityNavigationLink publicId={record._out.id} onClick={() => onClose()}>
                {record._out.name}
              </EntityNavigationLink>
            </div>
            {activeFields.length > 0 && (
              <div>
                {activeFields.map(field => (
                  <div key={field.id} className={overviewStyles.propRow}>
                    <div className={overviewStyles.propLabel}>{field.name}</div>
                    <div className={overviewStyles.propValue}>
                      {formatRelationFieldValue(field, record[field.id]) ?? (
                        <span className={sharedStyles.dim}>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.footer}>
              <Button onClick={() => setShowHistory(true)}>View history</Button>
            </div>
          </div>
        )}
      </Popover.Imperative>
      <RelationAuditLogDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        workspaceId={workspaceId}
        relation={record ?? null}
      />
    </>
  );
};
