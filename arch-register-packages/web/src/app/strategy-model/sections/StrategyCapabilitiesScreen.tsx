import { useMemo, useRef } from 'react';
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
import { entitiesQuery } from '../../../queries/entities';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { CapabilityDrawer } from './CapabilityDrawer';
import { CapabilityMaturityBar } from './CapabilityMaturityBar';
import { useCapabilityRollups, type CapabilityTableRollup } from '../useCapabilityRollups';
import { buildCapabilityTree, flattenCapabilityTree } from '../capabilityTree';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { STRATEGY_CAPABILITIES_ID, STRATEGY_RAIL_PATHS } from '../strategySections';
import type { CapabilitiesSearchParams } from '../../../routes/searchParams';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './StrategyCapabilitiesScreen.module.css';

type SortKey = 'name' | 'level' | 'owner' | 'maturity' | 'gap' | 'investment' | 'risk' | 'apps';

const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// `capability_level` is the derived 'L1'/'L2'/... text field (see `schemaTemplates.ts`); parses
// the number out of it for the Name column's tree-style indent. The indent only makes sense
// alongside the hierarchical "name" sort order (see `hierarchyIndex` below) — any other sort
// scatters siblings, so the table drops the indent for those.
const levelNumber = (capabilityLevel: string | null): number => {
  const match = capabilityLevel?.match(/\d+/);
  return match ? Number(match[0]) : 1;
};

// Mirrors the design reference's Gap column (`BCMCapabilityList`, `bcm-views.jsx`): "on target" or
// ahead of target (gap <= 0) reads as a plain dash rather than a signed number, and only a real
// gap gets the "+X.X" treatment, colored by how large it is.
const formatGap = (gap: number | null): { text: string; className?: string; style?: { color: string } } => {
  if (gap == null || gap <= 0) return { text: '—', className: 'dim' };
  // `--error-fg`/`--warning-fg` are the real severity tokens (`packages/main/src/tokens.css`) —
  // there's no dedicated "danger"/"success" token in this app, unlike the design reference.
  if (gap >= 1.5) return { text: `+${gap.toFixed(1)}`, style: { color: 'var(--error-fg, #e05252)' } };
  if (gap >= 0.5) return { text: `+${gap.toFixed(1)}`, style: { color: 'var(--warning-fg)' } };
  return { text: `+${gap.toFixed(1)}` };
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

const EMPTY_ROLLUP: CapabilityTableRollup = {
  avgMaturity: null,
  avgMaturityTarget: null,
  avgGap: null,
  avgRisk: null,
  sumAnnualInvestment: null,
  investmentCurrencyCode: null,
  appsCount: null
};

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
      [...new Set(allItems.map(item => strOrNull(item.capability_level)).filter((v): v is string => !!v))].sort(),
    [allItems]
  );

  const rollups = useCapabilityRollups(
    workspaceSlug,
    businessCapabilitySchemaId,
    strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId ?? null,
    items
  );
  const rollupFor = (id: string) => rollups.byId.get(id) ?? EMPTY_ROLLUP;

  // "Name" sort means level-aware, tree order (parent immediately followed by its children,
  // siblings alphabetical) rather than a plain alphabetical sort that would scatter siblings away
  // from their parent and make the Name column's indent (below) meaningless. Any other sort key
  // sorts flat and drops the indent instead of showing a tree order that doesn't match row order.
  const hierarchyIndex = useMemo(() => {
    const order = flattenCapabilityTree(buildCapabilityTree(tree.data?.nodes ?? [], tree.data?.edges ?? []));
    return new Map(order.map((id, index) => [id, index]));
  }, [tree.data]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    name: (a, b) => {
      const indexA = hierarchyIndex.get(a._uid);
      const indexB = hierarchyIndex.get(b._uid);
      if (indexA != null && indexB != null && indexA !== indexB) return indexA - indexB;
      return a._name.localeCompare(b._name);
    },
    level: (a, b) => compareNullableString(strOrNull(a.capability_level), strOrNull(b.capability_level)),
    owner: (a, b) => compareNullableString(a._owner?.name ?? null, b._owner?.name ?? null),
    maturity: (a, b) => compareNullableNumber(rollupFor(a._uid).avgMaturity, rollupFor(b._uid).avgMaturity),
    gap: (a, b) => compareNullableNumber(rollupFor(a._uid).avgGap, rollupFor(b._uid).avgGap),
    investment: (a, b) =>
      compareNullableNumber(rollupFor(a._uid).sumAnnualInvestment, rollupFor(b._uid).sumAnnualInvestment),
    risk: (a, b) => compareNullableNumber(rollupFor(a._uid).avgRisk, rollupFor(b._uid).avgRisk),
    apps: (a, b) => compareNullableNumber(rollupFor(a._uid).appsCount, rollupFor(b._uid).appsCount)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(items, comparators, {
    key: 'name',
    dir: 'asc'
  });

  const currentRoute = capabilityId
    ? { to: `${STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]}/$capabilityId`, params: { workspaceSlug, capabilityId } }
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

  // Default sort state is 'name', so no sort is treated the same as 'name' here.
  const showTreeIndent = (sort?.key ?? 'name') === 'name';

  const activeOwnerCount = search.owner ? 1 : 0;
  const clearAll = () => navigate({ ...currentRoute, search: () => ({}) });

  if (configurations.isLoading) return <div className={styles.empty}>Loading strategy model…</div>;
  if (!strategyConfig) {
    return <div className={styles.empty}>Strategy model is not enabled.</div>;
  }

  const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
  if (search.level) {
    chips.push({ key: 'level', label: 'Level', value: search.level, onRemove: () => patchSearch({ level: undefined }) });
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
                    onClick={() => patchSearch({ level: search.level === level ? undefined : level })}
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
            value={sort?.key ?? 'name'}
            onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'level', label: 'Level' },
              { value: 'owner', label: 'Owner' },
              { value: 'maturity', label: 'Maturity' },
              { value: 'gap', label: 'Gap' },
              { value: 'investment', label: 'Investment' },
              { value: 'risk', label: 'Risk' },
              { value: 'apps', label: 'Apps' }
            ]}
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
            <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
              Name
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="level" sort={sort} onSort={toggleSort}>
              Level
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="owner" sort={sort} onSort={toggleSort}>
              Owner
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="maturity" sort={sort} onSort={toggleSort}>
              Maturity
            </Table.SortableHeaderCell>
            <Table.HeaderCell numeric>Target</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="gap" sort={sort} onSort={toggleSort} numeric>
              Gap
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="investment" sort={sort} onSort={toggleSort} numeric>
              Investment
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="risk" sort={sort} onSort={toggleSort} numeric>
              Risk
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="apps" sort={sort} onSort={toggleSort} numeric>
              Apps
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={9}>
              {capabilities.isLoading ? 'Loading capabilities…' : 'No capabilities match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => {
              const rollup = rollupFor(entity._uid);
              const gap = formatGap(rollup.avgGap);
              return (
                <Table.Row key={entity._uid} onClick={() => openCapability(entity._publicId)}>
                  <Table.NameCell
                    title={entity._name}
                    subtitle={entity._publicId}
                    indentLevel={showTreeIndent ? levelNumber(strOrNull(entity.capability_level)) - 1 : 0}
                  />
                  <Table.Cell>{strOrNull(entity.capability_level) ?? <span className="dim">—</span>}</Table.Cell>
                  <Table.Cell>{entity._owner?.name ?? <span className="dim">—</span>}</Table.Cell>
                  <Table.Cell>
                    <CapabilityMaturityBar maturity={rollup.avgMaturity} />
                  </Table.Cell>
                  <Table.Cell numeric className="dim">
                    {rollup.avgMaturityTarget?.toFixed(1) ?? '—'}
                  </Table.Cell>
                  <Table.Cell numeric className={gap.className} style={gap.style}>
                    {gap.text}
                  </Table.Cell>
                  <Table.Cell numeric>
                    {rollup.sumAnnualInvestment == null
                      ? '—'
                      : formatCurrencyValue({
                          amount: rollup.sumAnnualInvestment,
                          currency: rollup.investmentCurrencyCode
                        })}
                  </Table.Cell>
                  <Table.Cell numeric>{rollup.avgRisk?.toFixed(1) ?? '—'}</Table.Cell>
                  <Table.Cell numeric>{rollup.appsCount ?? '—'}</Table.Cell>
                </Table.Row>
              );
            })
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
