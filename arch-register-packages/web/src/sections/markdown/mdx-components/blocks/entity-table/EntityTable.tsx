import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { TypeBadge } from '../../../../../components/TypeBadge';
import { StatusChip } from '../../../../../components/StatusChip';
import { useEntities } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../../../routes/publicObjectRoutes';
import { resolveSchemaColor } from '../../../../../lib/schemaPresentation';
import { Table } from '../../../../../components/table/Table';
import styles from './EntityTable.module.css';
import { EmptyState } from '../../../../../components/EmptyState';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export const normalizeEntityTableLimit = (limit: string | undefined): number => {
  const parsed = limit ? parseInt(limit, 10) : DEFAULT_LIMIT;
  const value = Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_LIMIT);
};

export const hasEntityTableFilter = (props: {
  schema?: string;
  owner?: string;
  lifecycle?: string;
}): boolean => !!(props.schema || props.owner || props.lifecycle);

type Props = {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
};

export const EntityTable = ({ schema, owner, lifecycle, limit }: Props) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();

  const hasFilter = hasEntityTableFilter({ schema, owner, lifecycle });
  const limitNum = normalizeEntityTableLimit(limit);

  const schemaIndex = useMemo(
    () => new Map(schemas.map((item, index) => [item.id, index])),
    [schemas]
  );

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: schema === '' ? undefined : schema,
      owner: owner === '' ? undefined : owner,
      lifecycle: lifecycle === '' ? undefined : lifecycle,
      view: 'full',
      limit: limitNum
    },
    { enabled: !!workspaceSlug && hasFilter }
  );

  if (!hasFilter) {
    return (
      <div className={styles.container}>
        <EmptyState compact title="No filters configured." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState compact title="No entities match the current filters." />
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <Table.Root className={styles.tableSurface}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Owner</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {entities.map(entity => {
            const schemaId = entity._schema.id;
            const schemaDef = schemas.find(item => item.id === schemaId);
            const schemaColorIndex = schemaIndex.get(schemaId) ?? 0;

            return (
              <Table.Row key={entity._uid}>
                <Table.NameCell
                  icon={
                    schemaDef && (
                      <TypeBadge
                        color={resolveSchemaColor(schemaDef, schemaColorIndex)}
                        name={schemaDef.name}
                        icon={schemaDef.icon}
                        size={18}
                      />
                    )
                  }
                  title={
                    <Link
                      {...entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId))}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {entity._name ?? entity._slug}
                    </Link>
                  }
                  subtitle={entity._description}
                />
                <Table.Cell>{schemaDef?.name ?? entity._schema.name}</Table.Cell>
                <Table.Cell>{entity._owner?.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  {entity._lifecycle ? (
                    <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  ) : (
                    '—'
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
