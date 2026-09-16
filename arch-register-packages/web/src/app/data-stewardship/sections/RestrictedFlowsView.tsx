import { useMemo } from 'react';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { relationIds } from '../../../lib/entityEditState';
import type { DataFlowConfig } from '../useDataFlowConfig';
import { isRestrictedClassification, relationFieldValue } from '../dataFlowClassification';
import { DataFlowNotConfiguredNotice } from './DataFlowNotConfiguredNotice';
import styles from './DataStewardshipStewardshipScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';

type SortKey = 'severity' | 'name';

const severityRank = (value: unknown): number => (value === 'highly-sensitive' ? 0 : 1);

/**
 * The "restricted flows" view: Data Flow relations carrying sensitive/highly-sensitive data
 * ("Restricted/Confidential" in the issue's wording — see `../dataFlowClassification.ts` for why
 * that's not a literal enum value). No `FlowDrawer` — every field the Data Flow schema has is
 * already in the row; carried-dataset chips reuse the shared `DatasetDrawer` instead of a new
 * detail panel.
 */
export const RestrictedFlowsView = ({
  workspaceSlug,
  dataFlowConfig,
  openDataset
}: {
  workspaceSlug: string;
  dataFlowConfig: DataFlowConfig | null;
  openDataset: (id: string) => void;
}) => {
  const relationSchemas = useRelationSchemas(workspaceSlug, dataFlowConfig != null);
  const relationSchema = relationSchemas.data?.find(
    candidate => candidate.id === dataFlowConfig?.relationSchemaId
  );

  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig != null }
  );

  const restricted = useMemo(
    () =>
      relations.data.filter(relation => isRestrictedClassification(relation.data_classification)),
    [relations.data]
  );

  const carriedEntityIds = useMemo(
    () => restricted.flatMap(relation => relationIds(relation.data_entities)),
    [restricted]
  );
  const carriedEntities = useEntitiesByIds(workspaceSlug, carriedEntityIds);

  const comparators: Record<SortKey, (a: RelationRecord, b: RelationRecord) => number> = {
    severity: (a, b) => severityRank(a.data_classification) - severityRank(b.data_classification),
    name: (a, b) => a._in.name.localeCompare(b._in.name)
  };
  const { sorted, sort, toggleSort } = useTableSort<RelationRecord, SortKey>(
    restricted,
    comparators,
    { key: 'severity', dir: 'asc' }
  );

  if (!dataFlowConfig) {
    return <DataFlowNotConfiguredNotice title="Restricted flows" />;
  }

  const highlySensitiveCount = restricted.filter(
    relation => relation.data_classification === 'highly-sensitive'
  ).length;
  const noProtocolCount = restricted.filter(relation => !relation.protocol).length;

  return (
    <>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Restricted flows</div>
          <div className={styles.tileValue}>{restricted.length}</div>
          <div className={styles.tileSub}>sensitive or highly sensitive</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Highly sensitive</div>
          <div
            className={styles.tileValue}
            style={highlySensitiveCount ? { color: DANGER } : undefined}
          >
            {highlySensitiveCount}
          </div>
          <div className={styles.tileSub}>top classification tier</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>No protocol recorded</div>
          <div className={styles.tileValue}>{noProtocolCount}</div>
          <div className={styles.tileSub}>a metadata gap, not a filter</div>
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Source system</Table.HeaderCell>
            <Table.HeaderCell>Destination system</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="severity" sort={sort} onSort={toggleSort}>
              Classification
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Protocol</Table.HeaderCell>
            <Table.HeaderCell>Carried data</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={5}>
              {relations.isLoading ? 'Loading flows…' : 'No restricted flows found.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(relation => {
              const ids = relationIds(relation.data_entities);
              return (
                <Table.Row key={relation._uid}>
                  <Table.Cell>{relation._in.name}</Table.Cell>
                  <Table.Cell>{relation._out.name}</Table.Cell>
                  <Table.Cell>
                    <Chip
                      tone="ghost"
                      color={
                        relation.data_classification === 'highly-sensitive' ? DANGER : undefined
                      }
                    >
                      {relationFieldValue(relationSchema, relation, 'data_classification')}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    {relationFieldValue(relationSchema, relation, 'protocol')}
                  </Table.Cell>
                  <Table.Cell>
                    {ids.length === 0 ? (
                      <span className="dim">—</span>
                    ) : (
                      <div className={styles.tags}>
                        {ids.map(id => {
                          const ref = carriedEntities.get(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              style={{
                                background: 'none',
                                border: 0,
                                padding: 0,
                                cursor: 'pointer',
                                font: 'inherit'
                              }}
                              onClick={() => openDataset(ref?.publicId ?? id)}
                            >
                              <Chip tone="ghost">{ref?.name ?? id}</Chip>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>
    </>
  );
};
