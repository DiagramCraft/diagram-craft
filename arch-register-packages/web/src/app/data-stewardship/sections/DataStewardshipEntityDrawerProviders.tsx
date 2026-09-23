import { dueLabel } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useDataStewardshipQueue } from '../dataStewardshipQueue';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps,
  type EntityDrawerRequiredField
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import styles from './DatasetDrawer.module.css';

const DATA_STEWARDSHIP_REQUIRED_FIELDS = [
  { id: 'classification' },
  { id: 'steward' },
  { id: 'custodian' },
  { id: 'review_date' },
  { id: 'review_status' },
  { id: 'stewardship_status' }
] satisfies readonly EntityDrawerRequiredField[];

const QueueItemsProvider = ({ context }: EntityDrawerProviderProps) => {
  const queue = useDataStewardshipQueue(context.workspaceId, context.schema.id, 'all');
  const items = queue.items.filter(item => item.dataset._uid === context.entity._uid);
  const state = queue.isLoading ? 'loading' : items.length > 0 ? 'ready' : 'empty';

  return (
    <EntityDrawerProviderStatus
      state={state}
      emptyMessage="Nothing in the queue against this dataset."
    >
      {items.map(item => {
        const content = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>
                {caseKindLabel(item.case.caseKind, item.case.payload)}
              </span>
            </div>
            <div className="dim" style={{ fontSize: 10.5, marginTop: 3 }}>
              <span className="mono">due {dueLabel(item.case.dueAt)}</span>
            </div>
          </>
        );

        return context.openGovernanceCase ? (
          <button
            key={item.case.id}
            type="button"
            className={styles.attributeRow}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 0,
              cursor: 'pointer'
            }}
            onClick={() => context.openGovernanceCase?.(item.case.id)}
          >
            {content}
          </button>
        ) : (
          <div key={item.case.id} className={styles.attributeRow}>
            {content}
          </div>
        );
      })}
    </EntityDrawerProviderStatus>
  );
};

export const dataStewardshipEntityDrawerProviderDefinitions = [
  {
    slotId: 'data-stewardship.queue-items',
    requiredFields: DATA_STEWARDSHIP_REQUIRED_FIELDS,
    Component: QueueItemsProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
