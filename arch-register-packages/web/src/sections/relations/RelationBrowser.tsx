import styles from './RelationBrowser.module.css';
import { Title } from '../../components/Title';
import { Table } from '../../components/table/Table';
import { useRelationBrowserData } from './useRelationBrowserData';

// Standalone relation-rooted browser (#2689): lists relation instances via the new
// /relations/query endpoint, distinct from the entity-embedded relation tab
// (EntityRelationsTab/RelationRecordList), which stays untouched. Table view only for v1 — no
// tree/radar/matrix/map/graph/topology, since those are entity-semantic views without a
// relation-rooted equivalent yet.
export const RelationBrowser = ({ workspaceId }: { workspaceId: string }) => {
  const { relationSchemas, schemaId, setSchemaId, activeSchema, relations, total, isLoading } =
    useRelationBrowserData(workspaceId);

  const fieldIds = activeSchema?.fields.map(field => field.id) ?? [];
  const columnCount = 3 + fieldIds.length;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title title="Relations" />
        <select
          className={styles.schemaSelect}
          value={schemaId ?? ''}
          onChange={e => setSchemaId(e.target.value || null)}
        >
          {relationSchemas.length === 0 && <option value="">No relation schemas</option>}
          {relationSchemas.map(schema => (
            <option key={schema.id} value={schema.id}>
              {schema.name}
            </option>
          ))}
        </select>
        {!isLoading && <span className={styles.count}>{total}</span>}
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell style={{ minWidth: 200 }}>In</Table.HeaderCell>
            <Table.HeaderCell style={{ minWidth: 200 }}>Out</Table.HeaderCell>
            {fieldIds.map(fieldId => (
              <Table.HeaderCell key={fieldId}>{fieldId}</Table.HeaderCell>
            ))}
            <Table.HeaderCell>Updated</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {relations.length === 0 ? (
            <Table.EmptyRow colSpan={columnCount}>
              {isLoading ? 'Loading…' : 'No relation instances found for this schema.'}
            </Table.EmptyRow>
          ) : (
            relations.map(relation => (
              <Table.Row key={relation._uid}>
                <Table.Cell>{relation._in.name}</Table.Cell>
                <Table.Cell>{relation._out.name}</Table.Cell>
                {fieldIds.map(fieldId => (
                  <Table.Cell key={fieldId}>{formatFieldValue(relation[fieldId])}</Table.Cell>
                ))}
                <Table.Cell>{new Date(relation._updatedAt).toLocaleString()}</Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};

const formatFieldValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};
