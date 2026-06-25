import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TypeBadge } from '../../../../../components/TypeBadge';
import { StatusChip } from '../../../../../components/StatusChip';
import { useEntities } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  entityDetailRoute
} from '../../../../../routes/publicObjectRoutes';
import { resolveSchemaColor } from '../../../../../lib/api';
import styles from './EntityTable.module.css';

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
  const navigate = useNavigate();
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
        <p className={styles.empty}>No filters configured.</p>
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
        <p className={styles.empty}>No entities match the current filters.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Owner</th>
            <th className={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {entities.map(entity => {
            const schemaId = entity._schema.id;
            const schemaDef = schemas.find(item => item.id === schemaId);
            const schemaColorIndex = schemaIndex.get(schemaId) ?? 0;

            return (
              <tr
                key={entity._uid}
                className={styles.row}
                onClick={() =>
                  navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
                }
              >
                <td className={styles.td}>
                  <div className={styles.entityCell}>
                    {schemaDef && (
                      <TypeBadge
                        color={resolveSchemaColor(schemaDef, schemaColorIndex)}
                        name={schemaDef.name}
                        icon={schemaDef.icon}
                        size={18}
                      />
                    )}
                    <div className={styles.entityText}>
                      <div className={styles.entityName}>{entity._name ?? entity._slug}</div>
                      {entity._description && (
                        <div className={styles.entityDescription}>{entity._description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className={styles.td}>{schemaDef?.name ?? entity._schema.name}</td>
                <td className={styles.td}>{entity._owner?.name ?? '—'}</td>
                <td className={styles.td}>
                  {entity._lifecycle ? (
                    <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
