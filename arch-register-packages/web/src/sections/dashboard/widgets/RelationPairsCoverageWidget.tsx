import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useRelations } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  computeRelationPairs,
  resolveTypedRelationSchemaId,
  type RelationPair
} from './relationPairCoverageLogic';

const WARN = 'var(--cmp-fg-warning, #eab308)';
const RELATION_LIMIT = 500;

export type RelationPairsCoverageWidgetConfig = {
  /** Display name of the hub entity schema (e.g. `API`) that providers and consumers attach to. */
  hubSchemaName: string;
  /** Typed-relation field (id or name) on the hub schema listing its providers. */
  providerFieldName: string;
  /** Typed-relation field (id or name) on the hub schema listing its consumers. */
  consumerFieldName: string;
  /** Relation type (by name) whose instances between a provider and a consumer count as coverage. */
  coverageRelationSchemaName: string;
  /** Column headings; default to the schema/field names. */
  hubLabel?: string;
  providerLabel?: string;
  consumerLabel?: string;
  coverageLabel?: string;
  label?: string;
};

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
