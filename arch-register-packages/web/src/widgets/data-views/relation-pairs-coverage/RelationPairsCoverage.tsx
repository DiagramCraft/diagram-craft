import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useRelations } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useWidgetBodyTitle } from '../../shared/dashboard/WidgetBodyTitle';
import {
  computeRelationPairCoverage,
  computeRelationPairs,
  resolveTypedRelationSchemaId,
  type RelationPair
} from './relationPairCoverageLogic';
import styles from './RelationPairsCoverage.module.css';
import { RelationPairsCoverageWidgetConfig } from './types';

const WARN = 'var(--cmp-fg-warning, #eab308)';
const DANGER = 'var(--cmp-fg-danger, #ef4444)';

const RELATION_LIMIT = 500;

type SortKey = 'consumer';

/**
 * Every provider × consumer pairing around each hub entity (e.g. every System providing × every
 * System consuming a given API), with a flag for whether a coverage relation (e.g. a Data Flow)
 * exists between the two. Not tied to any application: any hub schema with two typed-relation
 * fields and any relation type can be configured.
 */
export const RelationPairsCoverageWidget = ({
  config
}: {
  config: RelationPairsCoverageWidgetConfig;
}) => {
  const title = useWidgetBodyTitle();
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const hubSchema = schemas.find(candidate => candidate.name === config.hubSchemaName);
  const providerSchemaId = resolveTypedRelationSchemaId(hubSchema, config.providerFieldName);
  const consumerSchemaId = resolveTypedRelationSchemaId(hubSchema, config.consumerFieldName);
  const coverageSchemaId = relationSchemas.find(
    candidate => candidate.name === config.coverageRelationSchemaName
  )?.id;

  const providers = useRelations(
    workspaceSlug,
    { schemaId: providerSchemaId ?? undefined, limit: RELATION_LIMIT },
    { enabled: providerSchemaId != null }
  );
  const consumers = useRelations(
    workspaceSlug,
    { schemaId: consumerSchemaId ?? undefined, limit: RELATION_LIMIT },
    { enabled: consumerSchemaId != null }
  );
  const coverage = useRelations(
    workspaceSlug,
    { schemaId: coverageSchemaId, limit: RELATION_LIMIT },
    { enabled: coverageSchemaId != null }
  );

  const pairs = useMemo(
    () => computeRelationPairs(providers.data, consumers.data, coverage.data),
    [providers.data, consumers.data, coverage.data]
  );
  const { sorted, sort, toggleSort } = useTableSort<RelationPair, SortKey>(
    pairs,
    { consumer: (a, b) => a.consumer.name.localeCompare(b.consumer.name) },
    { key: 'consumer', dir: 'asc' }
  );

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

  const isLoading = providers.isLoading || consumers.isLoading || coverage.isLoading;
  if (config.display === 'stat') {
    const summary = computeRelationPairCoverage(pairs);
    return (
      <div className={styles.tile}>
        <div className={styles.label}>{title ?? 'Coverage gaps'}</div>
        <div className={styles.value} style={summary.gapPairs > 0 ? { color: DANGER } : undefined}>
          {isLoading ? '…' : summary.gapPairs}
        </div>
        <div className={styles.sub}>
          {summary.coveredPairs} of {summary.applicablePairs} covered
        </div>
      </div>
    );
  }
  return (
    <Table.Root scroll stickyHeader bordered={false}>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="consumer" sort={sort} onSort={toggleSort}>
            {config.consumerLabel ?? 'Consumer'}
          </Table.SortableHeaderCell>
          <Table.HeaderCell>{config.hubLabel ?? hubSchema.name}</Table.HeaderCell>
          <Table.HeaderCell>{config.providerLabel ?? 'Provider'}</Table.HeaderCell>
          <Table.HeaderCell>
            {config.coverageLabel ?? config.coverageRelationSchemaName}
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={4}>
            {isLoading ? 'Loading…' : `No ${hubSchema.name} is both provided and consumed.`}
          </Table.EmptyRow>
        ) : (
          sorted.map(pair => (
            <Table.Row key={pair.key}>
              <Table.NameCell title={pair.consumer.name} />
              <Table.Cell className="dim">{pair.hub.name}</Table.Cell>
              <Table.Cell className="dim">{pair.provider.name}</Table.Cell>
              <Table.Cell>
                {!pair.coverageApplicable ? (
                  <span className="dim">n/a (endpoint type)</span>
                ) : pair.hasCoverage ? (
                  <Chip tone="ghost">linked</Chip>
                ) : (
                  <Chip tone="ghost" color={WARN}>
                    gap
                  </Chip>
                )}
              </Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
