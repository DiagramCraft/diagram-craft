import { Fragment, useMemo, useState } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import type { EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { TypeBadge } from '../../../components/TypeBadge';
import { Table } from '../../../components/table/Table';
import {
  mapEntityLandscapeDiffToChangeRows,
  mapRelationLandscapeDiffToChangeRows
} from './entityTimelineHelpers';
import {
  ROW_OWNER_PRIORITY,
  classifyFieldChange,
  classifyRow,
  type ChangeOwner,
  type RowOwner
} from './landscapeDiffComparison';
import styles from './LandscapeDiffTable.module.css';

type SchemaInfo = { color: string; icon: string | null };
type ChangeKind = 'added' | 'removed' | 'changed';
type FieldChangeRow = {
  label: string;
  current?: string | null;
  from: string;
  to: string;
  owner?: ChangeOwner;
};

type DiffRow = {
  key: string;
  kind: ChangeKind;
  schemaId: string;
  schemaName: string;
  isRelation: boolean;
  name: string;
  publicId?: string;
  changes: FieldChangeRow[] | null;
  /** Which project a row belongs to; only set when comparing two projects. */
  owner: RowOwner | null;
};

/**
 * One table for every entity and relation difference, so the diff has a single scroll area.
 * Changed rows expand to show field-level differences. When comparing two projects, every row is
 * attributed to the project that made the change, or flagged as a conflict when both changed the
 * same field to different values.
 */
export const LandscapeDiffTable = ({
  diff,
  schemaMap,
  schemas,
  relationSchemaMap,
  relationSchemas,
  lifecycleStates,
  teams,
  comparison
}: {
  diff: EntityLandscapeDiff;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  relationSchemaMap: Map<string, SchemaInfo>;
  relationSchemas: RelationSchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  comparison?: { thisName: string; otherName: string };
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const rows = useMemo<DiffRow[]>(() => {
    const entitySchemaById = new Map(schemas.map(s => [s.id, s]));
    const relationSchemaById = new Map(relationSchemas.map(s => [s.id, s]));

    // Present only in the first project's end state ("removed") or the other's ("added").
    const ownerOf = (kind: ChangeKind, changes: FieldChangeRow[] | null): RowOwner | null => {
      if (!comparison) return null;
      if (kind === 'removed') return 'this';
      if (kind === 'added') return 'other';
      return classifyRow((changes ?? []).flatMap(change => (change.owner ? [change.owner] : [])));
    };
    const withOwners = (changes: FieldChangeRow[]): FieldChangeRow[] =>
      comparison
        ? changes.map(change =>
            change.current == null
              ? change
              : { ...change, owner: classifyFieldChange({ ...change, current: change.current }) }
          )
        : changes;

    const entityRow = (
      entity: EntityLandscapeDiff['added'][number],
      kind: ChangeKind,
      rawChanges: FieldChangeRow[] | null
    ): DiffRow => {
      const changes = rawChanges ? withOwners(rawChanges) : null;
      return {
        key: `entity:${kind}:${entity._uid}`,
        kind,
        schemaId: entity._schema.id,
        schemaName: entity._schema.name,
        isRelation: false,
        name: entity._name,
        publicId: entity._publicId,
        changes,
        owner: ownerOf(kind, changes)
      };
    };
    const relationRow = (
      relation: EntityLandscapeDiff['relations']['added'][number],
      kind: ChangeKind,
      rawChanges: FieldChangeRow[] | null
    ): DiffRow => {
      const changes = rawChanges ? withOwners(rawChanges) : null;
      return {
        key: `relation:${kind}:${relation._uid}`,
        kind,
        schemaId: relation._schema.id,
        schemaName: relation._schema.name,
        isRelation: true,
        name: `${relation._in.name} → ${relation._out.name}`,
        changes,
        owner: ownerOf(kind, changes)
      };
    };

    const all = [
      ...diff.added.map(entity => entityRow(entity, 'added', null)),
      ...diff.relations.added.map(relation => relationRow(relation, 'added', null)),
      ...diff.removed.map(entity => entityRow(entity, 'removed', null)),
      ...diff.relations.removed.map(relation => relationRow(relation, 'removed', null)),
      ...diff.changed.map(({ entity, diff: fieldDiff }) =>
        entityRow(
          entity,
          'changed',
          mapEntityLandscapeDiffToChangeRows(
            fieldDiff,
            entitySchemaById.get(entity._schema.id) ?? null,
            lifecycleStates,
            teams
          )
        )
      ),
      ...diff.relations.changed.map(({ relation, diff: fieldDiff }) =>
        relationRow(
          relation,
          'changed',
          mapRelationLandscapeDiffToChangeRows(
            fieldDiff,
            relationSchemaById.get(relation._schema.id) ?? null,
            lifecycleStates,
            teams
          )
        )
      )
    ];

    // Conflicts first when comparing projects, since they are what needs attention.
    return comparison
      ? all
          .map((row, index) => ({ row, index }))
          .sort(
            (a, b) =>
              ROW_OWNER_PRIORITY[a.row.owner ?? 'both'] -
                ROW_OWNER_PRIORITY[b.row.owner ?? 'both'] || a.index - b.index
          )
          .map(({ row }) => row)
      : all;
  }, [diff, schemas, relationSchemas, lifecycleStates, teams, comparison]);

  const toggleExpanded = (key: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No changes"
        subtitle={
          comparison
            ? 'The two projects leave the same entities and relations in the same state.'
            : 'No entities or relations were added, removed, or modified.'
        }
      />
    );
  }

  const ownerLabel = (owner: ChangeOwner | RowOwner | null, kind: ChangeKind): string => {
    if (!comparison || owner == null) {
      return { added: 'Added', removed: 'Removed', changed: 'Changed' }[kind];
    }
    switch (owner) {
      case 'conflict':
        return 'Conflict';
      case 'both':
        return 'Both projects';
      case 'this':
        return `Only in ${comparison.thisName}`;
      case 'other':
        return `Only in ${comparison.otherName}`;
    }
  };

  const counts = comparison
    ? rows.reduce<Record<RowOwner, number>>(
        (acc, row) => {
          acc[row.owner ?? 'both']++;
          return acc;
        },
        { conflict: 0, both: 0, this: 0, other: 0 }
      )
    : null;

  return (
    <>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell width={24} />
            <Table.HeaderCell width={comparison ? 200 : 140}>
              {comparison ? 'Changed in' : 'Change'}
            </Table.HeaderCell>
            <Table.HeaderCell width={200}>Type</Table.HeaderCell>
            <Table.HeaderCell>Name</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map(row => {
            const schemaInfo = (row.isRelation ? relationSchemaMap : schemaMap).get(row.schemaId);
            const expandable = row.changes != null;
            const expanded = expandable && expandedIds.has(row.key);
            const colCount = comparison ? 5 : 3;
            const labelWidth = comparison ? '16%' : '20%';
            const valueWidth = comparison ? '23%' : '40%';

            return (
              <Fragment key={row.key}>
                <Table.Row onClick={expandable ? () => toggleExpanded(row.key) : undefined}>
                  <Table.Cell width={24}>
                    {expandable && (
                      <button
                        type="button"
                        className={styles.entityRowExpand}
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />}
                      </button>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      tone={row.kind === 'changed' ? 'default' : 'ghost'}
                      color={row.owner === 'conflict' ? 'var(--warning-fg)' : undefined}
                    >
                      {ownerLabel(row.owner, row.kind)}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className={styles.entityRow}>
                      {schemaInfo && (
                        <TypeBadge color={schemaInfo.color} icon={schemaInfo.icon} size={16} />
                      )}
                      <span>{row.schemaName}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className={styles.entityRow}>
                      <span className={styles.entityName}>{row.name}</span>
                      {row.publicId && (
                        <span className={styles.entityPublicId}>{row.publicId}</span>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
                {expanded && row.changes && (
                  <Table.DetailRow>
                    <div className={styles.detailCell}>
                      <Table.Root>
                        <Table.Head>
                          <Table.Row>
                            <Table.HeaderCell width={labelWidth}>Field</Table.HeaderCell>
                            {comparison ? (
                              <>
                                <Table.HeaderCell width={valueWidth}>
                                  Current value
                                </Table.HeaderCell>
                                <Table.HeaderCell width={valueWidth}>
                                  {comparison.thisName}
                                </Table.HeaderCell>
                                <Table.HeaderCell width={valueWidth}>
                                  {comparison.otherName}
                                </Table.HeaderCell>
                                <Table.HeaderCell>Changed in</Table.HeaderCell>
                              </>
                            ) : (
                              <>
                                <Table.HeaderCell width={valueWidth}>
                                  Current Value
                                </Table.HeaderCell>
                                <Table.HeaderCell width={valueWidth}>New Value</Table.HeaderCell>
                              </>
                            )}
                          </Table.Row>
                        </Table.Head>
                        <Table.Body>
                          {row.changes.length === 0 ? (
                            <Table.EmptyRow colSpan={colCount + (comparison ? 1 : 0)}>
                              Restricted changes
                            </Table.EmptyRow>
                          ) : (
                            row.changes.map((change, idx) => (
                              <Table.Row key={idx}>
                                <Table.Cell>{change.label}</Table.Cell>
                                {comparison && <Table.Cell>{change.current ?? '—'}</Table.Cell>}
                                <Table.Cell>{change.from}</Table.Cell>
                                <Table.Cell>{change.to}</Table.Cell>
                                {comparison && (
                                  <Table.Cell>
                                    {change.owner ? ownerLabel(change.owner, 'changed') : '—'}
                                  </Table.Cell>
                                )}
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
      {comparison && counts && (
        <div className={styles.comparisonSummary}>
          <span className={counts.conflict > 0 ? styles.conflictCount : undefined}>
            {counts.conflict} {counts.conflict === 1 ? 'conflict' : 'conflicts'}
          </span>
          <span>
            {counts.this} only in {comparison.thisName}
          </span>
          <span>
            {counts.other} only in {comparison.otherName}
          </span>
          {counts.both > 0 && <span>{counts.both} changed by both without conflict</span>}
        </div>
      )}
    </>
  );
};
