import { EmptyState } from '../../../components/EmptyState';
import { useWidgetBodyTitle } from '../../shared/dashboard/WidgetBodyTitle';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import { computeRelationPairCoverage } from '../../data-views/relation-pairs-coverage/relationPairCoverageLogic';
import { useRelationPairCoverage } from '../../data-views/relation-pairs-coverage/useRelationPairCoverage';
import styles from './RelationPairGaps.module.css';
import { RelationPairGapsWidgetConfig } from './types';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';

/**
 * Number of provider × consumer pairs around a hub entity that lack a coverage relation (e.g. an
 * API's consumers without a Data Flow to its provider). The tile counterpart of the
 * `RelationPairsCoverage` table, configured the same way.
 */
export const RelationPairGapsWidget = ({ config }: { config: RelationPairGapsWidgetConfig }) => {
  const title = useWidgetBodyTitle();
  const framed = useWidgetFramed();
  const { hubSchema, providerSchemaId, consumerSchemaId, coverageSchemaId, pairs, isLoading } =
    useRelationPairCoverage(config);

  if (!hubSchema || providerSchemaId == null || consumerSchemaId == null) {
    return (
      <EmptyState
        title="Provider and consumer relations not found"
        subtitle={`'${config.hubSchemaName}' needs typed-relation fields '${config.providerFieldName}' and '${config.consumerFieldName}'.`}
        compact
      />
    );
  }
  if (coverageSchemaId == null) {
    return (
      <EmptyState
        title={`Relation type '${config.coverageRelationSchemaName}' not found`}
        compact
      />
    );
  }

  const summary = computeRelationPairCoverage(pairs);
  return (
    <div className={`${styles.tile} ${framed ? styles.framed : ''}`}>
      <div className={styles.label}>{title ?? 'Coverage gaps'}</div>
      <div className={styles.value} style={summary.gapPairs > 0 ? { color: DANGER } : undefined}>
        {isLoading ? '…' : summary.gapPairs}
      </div>
      <div className={styles.sub}>
        {summary.coveredPairs} of {summary.applicablePairs} covered
      </div>
    </div>
  );
};
