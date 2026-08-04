import { Fragment, useMemo, useState } from 'react';
import { TbChevronRight, TbChevronDown } from 'react-icons/tb';
import type { EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { EmptyState } from '../../../components/EmptyState';
import { TypeBadge } from '../../../components/TypeBadge';
import { Table } from '../../../components/table/Table';
import { mapRelationLandscapeDiffToChangeRows } from './entityTimelineHelpers';
import styles from './EntityLandscapeDiffTable.module.css';

type SchemaInfo = { color: string; icon: string | null };
type DiffRelation = EntityLandscapeDiff['relations']['added'][number];

export const RelationLandscapeDiffTable = ({
  diff,
  relationSchemaMap,
  relationSchemas,
  lifecycleStates,
  teams,
  addedTitle = 'Relations Added',
  removedTitle = 'Relations Removed',
  fromValueLabel = 'Current Value',
  toValueLabel = 'New Value'
}: {
  diff: EntityLandscapeDiff['relations'];
  relationSchemaMap: Map<string, SchemaInfo>;
  relationSchemas: RelationSchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  addedTitle?: string;
  removedTitle?: string;
  fromValueLabel?: string;
  toValueLabel?: string;
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const schemaById = useMemo(() => new Map(relationSchemas.map(s => [s.id, s])), [relationSchemas]);

  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { added, removed, changed } = diff;
  const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

  if (!hasChanges) {
    return (
      <EmptyState
        title="No relation changes"
        subtitle="No relations were added, removed, or modified."
      />
    );
  }

  return (
    <div className={styles.wrap}>
      {added.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {addedTitle} ({added.length})
          </div>
          <RelationList relations={added} relationSchemaMap={relationSchemaMap} />
        </div>
      )}

      {removed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {removedTitle} ({removed.length})
          </div>
          <RelationList relations={removed} relationSchemaMap={relationSchemaMap} />
        </div>
      )}

      {changed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Changed ({changed.length})</div>
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell />
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>In</Table.HeaderCell>
                <Table.HeaderCell>Out</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {changed.map(({ relation, diff: fieldDiff }) => {
                const schemaInfo = relationSchemaMap.get(relation._schema.id);
                const schema = schemaById.get(relation._schema.id) ?? null;
                const expanded = expandedIds.has(relation._uid);
                const changeRows = mapRelationLandscapeDiffToChangeRows(
                  fieldDiff,
                  schema,
                  lifecycleStates,
                  teams
                );

                return (
                  <Fragment key={relation._uid}>
                    <Table.Row onClick={() => toggleExpanded(relation._uid)}>
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
                          <span className={styles.entityName}>{relation._schema.name}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{relation._in.name}</Table.Cell>
                      <Table.Cell>{relation._out.name}</Table.Cell>
                    </Table.Row>
                    {expanded && (
                      <Table.DetailRow>
                        <div className={styles.detailCell}>
                          <Table.Root>
                            <Table.Head>
                              <Table.Row>
                                <Table.HeaderCell width="20%">Field</Table.HeaderCell>
                                <Table.HeaderCell width="40%">{fromValueLabel}</Table.HeaderCell>
                                <Table.HeaderCell width="40%">{toValueLabel}</Table.HeaderCell>
                              </Table.Row>
                            </Table.Head>
                            <Table.Body>
                              {changeRows.length === 0 ? (
                                <Table.EmptyRow colSpan={3}>Restricted changes</Table.EmptyRow>
                              ) : (
                                changeRows.map((change, idx) => (
                                  <Table.Row key={idx}>
                                    <Table.Cell>{change.label}</Table.Cell>
                                    <Table.Cell>{change.from}</Table.Cell>
                                    <Table.Cell>{change.to}</Table.Cell>
                                  </Table.Row>
                                ))
                              )}
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

const RelationList = ({
  relations,
  relationSchemaMap
}: {
  relations: DiffRelation[];
  relationSchemaMap: Map<string, SchemaInfo>;
}) => (
  <Table.Root>
    <Table.Head>
      <Table.Row>
        <Table.HeaderCell>Type</Table.HeaderCell>
        <Table.HeaderCell>In</Table.HeaderCell>
        <Table.HeaderCell>Out</Table.HeaderCell>
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {relations.map(relation => {
        const schemaInfo = relationSchemaMap.get(relation._schema.id);
        return (
          <Table.Row key={relation._uid}>
            <Table.Cell>
              <div className={styles.entityRow}>
                {schemaInfo && (
                  <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={16} />
                )}
                <span className={styles.entityName}>{relation._schema.name}</span>
              </div>
            </Table.Cell>
            <Table.Cell>{relation._in.name}</Table.Cell>
            <Table.Cell>{relation._out.name}</Table.Cell>
          </Table.Row>
        );
      })}
    </Table.Body>
  </Table.Root>
);
