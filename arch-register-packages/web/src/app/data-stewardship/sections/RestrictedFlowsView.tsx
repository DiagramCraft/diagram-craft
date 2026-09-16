import { useMemo, type ReactNode } from 'react';
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
const WARN = 'var(--cmp-fg-warning, #eab308)';

type SortKey = 'severity' | 'name';

const severityRank = (value: unknown): number => (value === 'highly-sensitive' ? 0 : 1);

/**
 * The "restricted flows" view: Data Flow relations carrying sensitive/highly-sensitive data
 * ("Restricted/Confidential" in the issue's wording — see `../dataFlowClassification.ts` for why
 * that's not a literal enum value). Mirrors the Claude Design reference's `DSClassification`'s
 * `view === "flows"` panel (`ds-views.jsx`): one `ar-panel`-style table titled "Flows carrying
 * restricted or confidential data", a single combined Flow (source → destination) column rather
 * than two, and a Boundary column (crosses/internal, from the real `cross_boundary` derived
 * field — the one column of the design's table this schema actually has data for). The design's
 * Style/Adapter/Volume/Health columns come from the Integration Catalog app (#3150, not present in
 * this repo) and have no equivalent on the Data Flow relation schema, so they're dropped rather
 * than faked; Protocol (a real field) stands in as the closest available "how it moves" signal.
 * No `FlowDrawer` — every field the Data Flow schema has is already in the row; carried-dataset
 * chips reuse the shared `DatasetDrawer` instead of a new detail panel.
 */
export const RestrictedFlowsView = ({
  workspaceSlug,
  dataFlowConfig,
  openDataset,
  viewSwitcher
}: {
  workspaceSlug: string;
  dataFlowConfig: DataFlowConfig | null;
  openDataset: (id: string) => void;
  viewSwitcher: ReactNode;
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
    return (
      <>
        {viewSwitcher}
        <DataFlowNotConfiguredNotice title="Restricted flows" />
      </>
    );
  }

  const highlySensitiveCount = restricted.filter(
    relation => relation.data_classification === 'highly-sensitive'
  ).length;
  const crossingCount = restricted.filter(
    relation => relation.cross_boundary === 'cross-boundary'
  ).length;

  return (
    <>
      <div className={styles.tilesThree}>
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
          <div className={styles.tileLabel}>Crossing a boundary</div>
          <div className={styles.tileValue} style={crossingCount ? { color: WARN } : undefined}>
            {crossingCount}
          </div>
          <div className={styles.tileSub}>source and destination regions differ</div>
        </div>
      </div>

      {viewSwitcher}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Flows carrying restricted or confidential data</span>
          <span className="dim mono">{restricted.length}</span>
        </div>
        <Table.Root scroll>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell style={{ minWidth: 220 }}>Flow</Table.HeaderCell>
              <Table.HeaderCell>Dataset carried</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="severity" sort={sort} onSort={toggleSort}>
                Classification
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Protocol</Table.HeaderCell>
              <Table.HeaderCell>Boundary</Table.HeaderCell>
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
                const crosses = relation.cross_boundary === 'cross-boundary';
                return (
                  <Table.Row key={relation._uid}>
                    <Table.Cell>
                      {relation._in.name} → {relation._out.name}
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
                    <Table.Cell className="dim">
                      {relationFieldValue(relationSchema, relation, 'protocol')}
                    </Table.Cell>
                    <Table.Cell>
                      {crosses ? (
                        <Chip tone="ghost" color={WARN}>
                          crosses
                        </Chip>
                      ) : (
                        <span className="dim">internal</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </div>
    </>
  );
};
