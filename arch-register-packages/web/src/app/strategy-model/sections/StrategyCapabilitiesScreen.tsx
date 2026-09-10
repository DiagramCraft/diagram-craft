import { type ReactNode, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Title } from '../../../components/Title';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useTeams } from '../../../hooks/useWorkspaceConfig';
import { useEntityTree } from '../../../hooks/useEntities';
import { useSchemas } from '../../../hooks/useSchemas';
import { entitiesQuery } from '../../../queries/entities';
import { CapabilityDrawer } from './CapabilityDrawer';
import { useCapabilityRollups, type CapabilityTableRollup } from '../useCapabilityRollups';
import { buildCapabilityTree, flattenCapabilityTree } from '../capabilityTree';
import {
  capabilityFieldValue,
  capabilityNumericValue,
  fieldLabel
} from '../capabilityFieldDisplay';
import { CapabilityRollupValue, displayIsNumeric } from './CapabilityRollupValue';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig, resolveStrategyViewConfig } from '../strategyQueries';
import { STRATEGY_CAPABILITIES_ID, STRATEGY_RAIL_PATHS } from '../strategySections';
import type { CapabilitiesSearchParams } from '../../../routes/searchParams';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { DerivedTableColumn } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './StrategyCapabilitiesScreen.module.css';

const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// `capability_level` is the derived 'L1'/'L2'/... text field (see `schemaTemplates.ts`); parses
// the number out of it for the Name column's tree-style indent. The indent only makes sense
// alongside the hierarchical "name" sort order (see `hierarchyIndex` below) — any other sort
// scatters siblings, so the table drops the indent for those.
const levelNumber = (capabilityLevel: string | null): number => {
  const match = capabilityLevel?.match(/\d+/);
  return match ? Number(match[0]) : 1;
};

const compareNullableNumber = (a: number | null, b: number | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
};

const compareNullableString = (a: string | null, b: string | null): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
};

// Walks `edges` from `rootId` to collect every descendant id (plus the root itself), so the
// sidebar's "filter to this subtree" click can be applied to the flat capability list fetched
// here without a second, differently-shaped server request.
const collectSubtreeIds = (
  rootId: string,
  edges: readonly { parentId: string; childId: string }[]
): Set<string> => {
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    childrenOf.set(edge.parentId, [...(childrenOf.get(edge.parentId) ?? []), edge.childId]);
  }
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenOf.get(current) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }
  return result;
};

const EMPTY_ROLLUP: CapabilityTableRollup = { values: {}, currency: {}, appsCount: null };

export const StrategyCapabilitiesScreen = () => {
  const { workspaceSlug, capabilityId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    capabilityId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as CapabilitiesSearchParams;
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);
  const businessCapabilitySchemaId = strategyConfig?.businessCapabilitySchemaId ?? null;
  const schemas = useSchemas(workspaceSlug);
  const businessCapabilitySchema = schemas.data?.find(
    schema => schema.id === businessCapabilitySchemaId
  );
  const view = resolveStrategyViewConfig(configurations.data, businessCapabilitySchema);
  const columns = view.tableColumns;

  const { data: owners = [] } = useTeams(workspaceSlug);
  // `view: 'full'`, not 'summary': the Level column reads `capability_level`, a schema-defined
  // (derived) field, and `toApiEntitySummary` on the server omits schema `data` fields entirely —
  // only the full entity projection carries them (see `CapabilityDrawer`, which fetches one
  // capability in full for the same reason).
  const capabilities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: businessCapabilitySchemaId, view: 'full', limit: 1000 },
      businessCapabilitySchemaId != null
    )
  );
  // Feeds both the `subtreeOf` descendant-id resolution below and the hierarchical "name" sort
  // order (`hierarchyIndex`) — same schema-scoped tree data the sidebar's capability tree fetches,
  // so this shares its query-cache entry rather than doubling the request.
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: businessCapabilitySchemaId ?? undefined },
    businessCapabilitySchemaId != null
  );

  const allItems = capabilities.data?.items ?? [];

  const subtreeIds = useMemo(
    () => (search.subtreeOf ? collectSubtreeIds(search.subtreeOf, tree.data?.edges ?? []) : null),
    [search.subtreeOf, tree.data]
  );

  const items = useMemo(
    () =>
      allItems.filter(item => {
        if (search.level && strOrNull(item.capability_level) !== search.level) return false;
        if (search.owner && item._owner?.id !== search.owner) return false;
        if (subtreeIds && !subtreeIds.has(item._uid)) return false;
        return true;
      }),
    [allItems, search.level, search.owner, subtreeIds]
  );

  const levels = useMemo(
    () =>
      [
        ...new Set(
          allItems.map(item => strOrNull(item.capability_level)).filter((v): v is string => !!v)
        )
      ].sort(),
    [allItems]
  );

  const rollups = useCapabilityRollups(
    workspaceSlug,
    businessCapabilitySchemaId,
    strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId ?? null,
    items,
    view.rollups,
    tree.data?.edges ?? []
  );
  const rollupFor = (id: string) => rollups.byId.get(id) ?? EMPTY_ROLLUP;

  // "Name" sort means level-aware, tree order (parent immediately followed by its children,
  // siblings alphabetical) rather than a plain alphabetical sort that would scatter siblings away
  // from their parent and make the Name column's indent (below) meaningless. Any other sort key
  // sorts flat and drops the indent instead of showing a tree order that doesn't match row order.
  const hierarchyIndex = useMemo(() => {
    const order = flattenCapabilityTree(
      buildCapabilityTree(tree.data?.nodes ?? [], tree.data?.edges ?? [])
    );
    return new Map(order.map((id, index) => [id, index]));
  }, [tree.data]);

  const comparators = useMemo(() => {
    const compareValue = (
      entity: EntityRecord,
      column: DerivedTableColumn
    ): { number: number | null } | { string: string | null } => {
      if (column.fieldId === '_level') return { string: strOrNull(entity.capability_level) };
      if (column.fieldId === '_owner') return { string: entity._owner?.name ?? null };
      const rollup = rollups.byId.get(entity._uid) ?? EMPTY_ROLLUP;
      if (column.fieldId === '_apps') return { number: rollup.appsCount };
      if (column.kind === 'field' && column.hasRollup)
        return { number: rollup.values[column.fieldId] ?? null };
      const field = businessCapabilitySchema?.fields.find(f => f.id === column.fieldId);
      if (field?.type === 'number' || field?.type === 'currency')
        return { number: capabilityNumericValue(entity, column.fieldId).value };
      return { string: capabilityFieldValue(businessCapabilitySchema, entity, column.fieldId) };
    };
    const record: Record<string, (a: EntityRecord, b: EntityRecord) => number> = {
      _name: (a, b) => {
        const indexA = hierarchyIndex.get(a._uid);
        const indexB = hierarchyIndex.get(b._uid);
        if (indexA != null && indexB != null && indexA !== indexB) return indexA - indexB;
        return a._name.localeCompare(b._name);
      }
    };
    for (const column of columns) {
      if (column.fieldId === '_name') continue;
      record[column.fieldId] = (a, b) => {
        const va = compareValue(a, column);
        const vb = compareValue(b, column);
        return 'number' in va && 'number' in vb
          ? compareNullableNumber(va.number, vb.number)
          : compareNullableString(
              'string' in va ? va.string : null,
              'string' in vb ? vb.string : null
            );
      };
    }
    return record;
  }, [columns, hierarchyIndex, rollups.byId, businessCapabilitySchema]);

  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, string>(items, comparators, {
    key: '_name',
    dir: 'asc'
  });

  const currentRoute = capabilityId
    ? {
        to: `${STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]}/$capabilityId`,
        params: { workspaceSlug, capabilityId }
      }
    : { to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID], params: { workspaceSlug } };

  const patchSearch = (patch: Record<string, unknown>) =>
    navigate({
      ...currentRoute,
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openCapability = (id: string) =>
    navigate({
      to: `${STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]}/$capabilityId`,
      params: { workspaceSlug, capabilityId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeCapability = () =>
    navigate({
      to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  // The Name column's tree indent only lines up with a hierarchical sort.
  const showTreeIndent = (sort?.key ?? '_name') === '_name';

  const STRUCTURAL_LABELS: Record<string, string> = {
    _name: 'Name',
    _level: 'Level',
    _owner: 'Owner',
    _apps: 'Apps'
  };
  const columnLabel = (column: DerivedTableColumn): string =>
    column.kind === 'structural'
      ? (STRUCTURAL_LABELS[column.fieldId] ?? column.fieldId)
      : (column.header ?? fieldLabel(businessCapabilitySchema, column.fieldId));

  const isNumericColumn = (column: DerivedTableColumn): boolean => {
    if (column.fieldId === '_apps') return true;
    if (column.kind !== 'field') return false;
    if (!displayIsNumeric(column.display)) return false;
    if (column.hasRollup) return true;
    const field = businessCapabilitySchema?.fields.find(f => f.id === column.fieldId);
    return field?.type === 'number' || field?.type === 'currency';
  };

  const renderColumnValue = (entity: EntityRecord, column: DerivedTableColumn): ReactNode => {
    if (column.fieldId === '_level')
      return strOrNull(entity.capability_level) ?? <span className="dim">—</span>;
    if (column.fieldId === '_owner') return entity._owner?.name ?? <span className="dim">—</span>;
    if (column.fieldId === '_apps') return rollupFor(entity._uid).appsCount ?? '—';
    if (column.kind !== 'field') return null;
    if (column.display === 'plain' && !column.hasRollup)
      return capabilityFieldValue(businessCapabilitySchema, entity, column.fieldId);
    const rollup = rollupFor(entity._uid);
    const own = capabilityNumericValue(entity, column.fieldId);
    return (
      <CapabilityRollupValue
        value={column.hasRollup ? (rollup.values[column.fieldId] ?? null) : own.value}
        currency={column.hasRollup ? (rollup.currency[column.fieldId] ?? null) : own.currency}
        display={column.display}
        format={column.format}
        fieldId={column.fieldId}
        schema={businessCapabilitySchema}
      />
    );
  };

  const activeOwnerCount = search.owner ? 1 : 0;
  const clearAll = () => navigate({ ...currentRoute, search: () => ({}) });

  if (configurations.isLoading) return <div className={styles.empty}>Loading strategy model…</div>;
  if (!strategyConfig) {
    return <div className={styles.empty}>Strategy model is not enabled.</div>;
  }

  const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
  if (search.level) {
    chips.push({
      key: 'level',
      label: 'Level',
      value: search.level,
      onRemove: () => patchSearch({ level: undefined })
    });
  }
  if (search.owner) {
    chips.push({
      key: 'owner',
      label: 'Owner',
      value: owners.find(owner => owner.id === search.owner)?.name ?? search.owner,
      onRemove: () => patchSearch({ owner: undefined })
    });
  }
  if (search.subtreeOf) {
    const root = allItems.find(item => item._uid === search.subtreeOf);
    chips.push({
      key: 'subtree',
      label: 'Subtree',
      value: root?._name ?? search.subtreeOf,
      onRemove: () => patchSearch({ subtreeOf: undefined })
    });
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          title="Capabilities"
          chips={!capabilities.isLoading && <span className={styles.count}>{items.length}</span>}
          description="Every Business Capability with maturity, investment, risk, and coverage roll-ups over its containment subtree."
        />
      </div>

      <div className={filterStyles.toolbar}>
        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger
            element={
              <Button
                size="sm"
                variant={activeOwnerCount > 0 || search.level ? 'primary' : 'secondary'}
                icon={<TbFilter size={12} />}
              >
                Level / Owner
                {activeOwnerCount + (search.level ? 1 : 0) > 0 && (
                  <span className={filterStyles.filterCount}>
                    {activeOwnerCount + (search.level ? 1 : 0)}
                  </span>
                )}
              </Button>
            }
          />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={filterStyles.filterPopover}
          >
            <div className={styles.ownerPopover}>
              <div className={styles.pillGroupLabel}>Level</div>
              <div className={styles.pillRow}>
                {levels.map(level => (
                  <button
                    key={level}
                    type="button"
                    className={`${styles.pill} ${search.level === level ? styles.pillActive : ''}`}
                    onClick={() =>
                      patchSearch({ level: search.level === level ? undefined : level })
                    }
                  >
                    {level}
                  </button>
                ))}
                {levels.length === 0 && <span className="dim">No capabilities yet.</span>}
              </div>
              <div className={styles.pillGroupLabel}>Owner</div>
              <div className={styles.pillRow}>
                {owners.map(owner => (
                  <button
                    key={owner.id}
                    type="button"
                    className={`${styles.pill} ${search.owner === owner.id ? styles.pillActive : ''}`}
                    onClick={() =>
                      patchSearch({ owner: search.owner === owner.id ? undefined : owner.id })
                    }
                  >
                    {owner.name}
                  </button>
                ))}
                {owners.length === 0 && <span className="dim">No owners configured.</span>}
              </div>
            </div>
          </Popover.Content>
        </Popover.Root>
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="Sort"
            value={sort?.key ?? '_name'}
            onChange={value => value !== sort?.key && toggleSort(value)}
            options={columns.map(column => ({
              value: column.fieldId,
              label: columnLabel(column)
            }))}
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.activeFilters}>
          {chips.map(chip => (
            <span key={chip.key} className={styles.activeChip}>
              <span className={styles.activeChipLabel}>{chip.label}</span>
              <span>{chip.value}</span>
              <button
                type="button"
                className={styles.activeChipRemove}
                onClick={chip.onRemove}
                title={`Remove ${chip.label}`}
              >
                ×
              </button>
            </span>
          ))}
          <Button variant="ghost" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      )}

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            {columns.map(column => (
              <Table.SortableHeaderCell
                key={column.fieldId}
                sortKey={column.fieldId}
                sort={sort}
                onSort={toggleSort}
                numeric={column.fieldId !== '_name' && isNumericColumn(column)}
              >
                {columnLabel(column)}
              </Table.SortableHeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={Math.max(1, columns.length)}>
              {capabilities.isLoading
                ? 'Loading capabilities…'
                : 'No capabilities match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => (
              <Table.Row key={entity._uid} onClick={() => openCapability(entity._publicId)}>
                {columns.map(column =>
                  column.fieldId === '_name' ? (
                    <Table.NameCell
                      key={column.fieldId}
                      title={entity._name}
                      subtitle={entity._publicId}
                      indentLevel={
                        showTreeIndent
                          ? levelNumber(strOrNull(entity.capability_level)) - 1
                          : 0
                      }
                    />
                  ) : (
                    <Table.Cell key={column.fieldId} numeric={isNumericColumn(column)}>
                      {renderColumnValue(entity, column)}
                    </Table.Cell>
                  )
                )}
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {capabilityId && strategyConfig && (
        <CapabilityDrawer
          workspaceSlug={workspaceSlug}
          capabilityId={capabilityId}
          strategyConfig={strategyConfig}
          onClose={closeCapability}
          onOpenCapability={openCapability}
        />
      )}
    </main>
  );
};
