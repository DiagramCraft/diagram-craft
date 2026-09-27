import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { useMostConsumedApis } from '../useMostConsumedApis';
import styles from './ApiIntegrationCatalogOverviewScreen.module.css';

type Props = {
  workspaceId: string;
  apiSchemaId: string | null;
  onOpenApi: (publicId: string) => void;
  onViewCatalog: () => void;
};

/**
 * The Overview section's "Most consumed APIs" panel (#3458) — extracted from
 * `ApiIntegrationCatalogOverviewScreen.tsx`'s former inline JSX into a standalone, self-fetching
 * component matching `ApiBlastRadiusPanel.tsx`'s shape.
 */
export const ApiIntegrationCatalogMostConsumedPanel = ({
  workspaceId,
  apiSchemaId,
  onOpenApi,
  onViewCatalog
}: Props) => {
  const mostConsumed = useMostConsumedApis(workspaceId, apiSchemaId);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Most consumed APIs</span>
        <button type="button" className={styles.panelLink} onClick={onViewCatalog}>
          Catalog
        </button>
      </div>
      <div className={styles.stack}>
        {mostConsumed.status === 'loading' ? (
          <div className={styles.row}>
            <LoadingState text="Loading APIs…" size="sm" />
          </div>
        ) : mostConsumed.status === 'error' ? (
          <div className={styles.row}>
            <Banner variant="error">Could not load APIs.</Banner>
          </div>
        ) : mostConsumed.status === 'empty' ? (
          <div className={styles.row}>
            <EmptyState title="No APIs registered yet" compact />
          </div>
        ) : (
          mostConsumed.items.map(({ entity, consumerCount, operationsCount }) => (
            <button
              key={entity._uid}
              type="button"
              className={styles.row}
              onClick={() => onOpenApi(entity._publicId)}
            >
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{entity._name}</span>
                <span className={`${styles.rowSub} dim`}>
                  {operationsCount ?? '—'} operations · {entity._owner?.name ?? 'unowned'}
                </span>
              </span>
              <span className="mono tabular dim">{consumerCount}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
