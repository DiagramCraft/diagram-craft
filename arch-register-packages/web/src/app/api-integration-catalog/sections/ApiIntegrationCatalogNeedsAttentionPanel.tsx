import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useApiIntegrationCatalogQueue } from '../apiIntegrationCatalogQueue';
import styles from './ApiIntegrationCatalogPanels.module.css';

const QUEUE_LIMIT = 8;

type Props = {
  workspaceId: string;
  apiSchemaId: string | null;
  onOpenApi: (publicId: string) => void;
  limit?: number;
  embedded?: boolean;
};

/**
 * The Overview section's "Needs attention" queue panel (#3458) — extracted from
 * the former Overview screen's inline JSX into a standalone, self-fetching
 * component matching `ApiBlastRadiusPanel.tsx`'s shape.
 */
export const ApiIntegrationCatalogNeedsAttentionPanel = ({
  workspaceId,
  apiSchemaId,
  onOpenApi,
  limit = QUEUE_LIMIT,
  embedded = false
}: Props) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const queue = useApiIntegrationCatalogQueue(workspaceId, apiSchemaId, apiSchemaId != null);

  return (
    <div className={embedded ? styles.widgetPanel : styles.panel}>
      <div className={embedded ? styles.widgetHeader : styles.panelHeader}>
        {!embedded && <span className={styles.panelTitle}>Needs attention</span>}
        <span className="dim mono">{queue.items.length}</span>
      </div>
      <div className={styles.stack}>
        {queue.isLoading ? (
          <div className={styles.row}>
            <LoadingState text="Loading queue…" size="sm" />
          </div>
        ) : queue.isError ? (
          <div className={styles.row}>
            <Banner variant="error">Could not load the queue.</Banner>
          </div>
        ) : queue.items.length === 0 ? (
          <div className={styles.row}>
            <EmptyState title="Nothing awaiting a decision" compact />
          </div>
        ) : (
          queue.items.slice(0, limit).map(item => (
            <button
              key={item.case.id}
              type="button"
              className={styles.row}
              onClick={() => onOpenApi(item.api._publicId)}
            >
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{item.api._name}</span>
                <span className={`${styles.rowSub} dim`}>
                  {caseKindLabel(item.case.caseKind, item.case.payload)}
                </span>
              </span>
              {item.case.dueAt && (
                <span className="dim mono" style={{ fontSize: 10.5 }}>
                  due {formatDate(item.case.dueAt, '—', dateTimeFormatPreference)}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
