import { Fragment, useMemo, useState } from 'react';
import { TbChevronRight, TbChevronDown } from 'react-icons/tb';
import type { EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { EmptyState } from '../../../components/EmptyState';
import { TypeBadge } from '../../../components/TypeBadge';
import { Table } from '../../../components/table/Table';
import { mapEntityLandscapeDiffToChangeRows } from './entityTimelineHelpers';
import styles from './EntityLandscapeDiffTable.module.css';

type SchemaInfo = { color: string; icon: string | null };
type DiffEntity = EntityLandscapeDiff['added'][number];

export const EntityLandscapeDiffTable = ({
  diff,
  schemaMap,
  schemas,
  lifecycleStates,
  teams
}: {
  diff: EntityLandscapeDiff;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const schemaById = useMemo(() => new Map(schemas.map(s => [s.id, s])), [schemas]);

  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { added, removed, changed } = diff;
  const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

  return (
    <div className={styles.wrap}>
      {!hasChanges && (
        <EmptyState title="No changes" subtitle="No entities were added, removed, or modified." />
      )}

      {added.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Added ({added.length})</div>
          <EntityList entities={added} schemaMap={schemaMap} />
        </div>
      )}

      {removed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Removed ({removed.length})</div>
          <EntityList entities={removed} schemaMap={schemaMap} />
        </div>
      )}

      {changed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Changed ({changed.length})</div>
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell />
                <Table.HeaderCell>Entity</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {changed.map(({ entity, diff: fieldDiff }) => {
                const schemaInfo = schemaMap.get(entity._schema.id);
                const schema = schemaById.get(entity._schema.id) ?? null;
                const expanded = expandedIds.has(entity._uid);
                const changeRows = mapEntityLandscapeDiffToChangeRows(
                  fieldDiff,
                  schema,
                  lifecycleStates,
                  teams
                );
                return (
                  <Fragment key={entity._uid}>
                    <Table.Row onClick={() => toggleExpanded(entity._uid)}>
                      <Table.Cell width={24}>
                        <button
                          type="button"
                          className={styles.entityRowExpand}
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        >
                          {expanded ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />}
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        <div className={styles.entityRow}>
                          {schemaInfo && (
                            <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={16} />
                          )}
                          <span className={styles.entityName}>{entity._name}</span>
                          <span className={styles.entityPublicId}>{entity._publicId}</span>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                    {expanded && (
                      <Table.DetailRow>
                        <div className={styles.detailCell}>
                          <Table.Root bordered={false}>
                            <Table.Head>
                              <Table.Row>
                                <Table.HeaderCell>Field</Table.HeaderCell>
                                <Table.HeaderCell>Current Value</Table.HeaderCell>
                                <Table.HeaderCell>New Value</Table.HeaderCell>
                              </Table.Row>
                            </Table.Head>
                            <Table.Body>
                              {changeRows.map((change, idx) => (
                                <Table.Row key={idx}>
                                  <Table.Cell>{change.label}</Table.Cell>
                                  <Table.Cell>{change.from}</Table.Cell>
                                  <Table.Cell>{change.to}</Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table.Root>
                        </div>
                      </Table.DetailRow>
                    )}
                  </Fragment>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </div>
  );
};

const EntityList = ({
  entities,
  schemaMap
}: {
  entities: DiffEntity[];
  schemaMap: Map<string, SchemaInfo>;
}) => (
  <Table.Root>
    <Table.Head>
      <Table.Row>
        <Table.HeaderCell>Entity</Table.HeaderCell>
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {entities.map(entity => {
        const schemaInfo = schemaMap.get(entity._schema.id);
        return (
          <Table.Row key={entity._uid}>
            <Table.Cell>
              <div className={styles.entityRow}>
                {schemaInfo && (
                  <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={16} />
                )}
                <span className={styles.entityName}>{entity._name}</span>
                <span className={styles.entityPublicId}>{entity._publicId}</span>
              </div>
            </Table.Cell>
          </Table.Row>
        );
      })}
    </Table.Body>
  </Table.Root>
);
