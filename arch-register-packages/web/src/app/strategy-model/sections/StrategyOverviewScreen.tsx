import { useMemo } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Title } from '../../../components/Title';
import { Table } from '../../../components/table/Table';
import { useEntityTree } from '../../../hooks/useEntities';
import { useRelations } from '../../../hooks/useRelations';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { useCapabilityRollups } from '../useCapabilityRollups';
import { formatGap } from './capabilityGap';
import {
  StackedBar,
  Section,
  formatPercent,
  type BarBucket
} from '../../../sections/workspace-settings/sub-sections/analytics/analyticsPrimitives';
import {
  STRATEGY_RAIL_PATHS,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID
} from '../strategySections';
import styles from './StrategyOverviewScreen.module.css';

const strOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

// `strategy-status` enum (`schemaTemplates.ts`), in reporting order; colours mirror
// `StrategyStrategyScreen`'s `STATUS_TONE`.
const STATUS_ORDER = ['draft', 'active', 'achieved', 'abandoned'] as const;
const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--text-muted)',
  active: 'var(--accent-fg)',
  achieved: 'var(--green)',
  abandoned: 'var(--error-fg, #e05252)'
};

// Fallback palette for the capability-level bar (there is no per-level token, same as the
// capability map's overlay bands).
const LEVEL_COLORS = ['var(--accent-fg)', 'var(--green)', 'var(--warning-fg)', 'var(--text-muted)'];

const GAP_TILE_LIMIT = 5;

/**
 * The Strategy & Capability Modelling app's landing screen (`sections[0]`, so the app switcher
 * opens here). A read-only dashboard of summary tiles — capability count by level, objectives by
 * status, application coverage, orphan capabilities, and the largest maturity gaps — each linking
 * into the relevant detail section. Everything is derived client-side from the same entity /
 * relation queries the other sections use; there is no bespoke server endpoint (see
 * `strategyQueries.ts`).
 */
export const StrategyOverviewScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);
  const enabled = strategyConfig != null;

  // `view: 'full'` so `capability_level` / `status` (derived schema `data` fields the summary
  // projection omits) are readable — same reason the other sections fetch full.
  const capabilities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.businessCapabilitySchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  const objectives = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.objectiveSchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  // Shared query-cache entry with the other sections' capability tree.
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: strategyConfig?.businessCapabilitySchemaId ?? undefined },
    enabled
  );
  const objectiveSupportsCapability = useRelations(
    workspaceSlug,
    { schemaId: strategyConfig?.objectiveSupportsBusinessCapabilityRelationSchemaId },
    {
      enabled:
        enabled && strategyConfig?.objectiveSupportsBusinessCapabilityRelationSchemaId != null
    }
  );
  const capabilitySupportsEntity = useRelations(
    workspaceSlug,
    { schemaId: strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId },
    {
      enabled: enabled && strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId != null
    }
  );

  const capabilityItems = capabilities.data?.items ?? [];
  const objectiveItems = objectives.data?.items ?? [];

  const rollups = useCapabilityRollups(
    workspaceSlug,
    strategyConfig?.businessCapabilitySchemaId ?? null,
    strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId ?? null,
    capabilityItems,
    tree.data?.edges ?? []
  );

  const levelBuckets = useMemo<BarBucket[]>(() => {
    const counts = new Map<string, number>();
    for (const item of capabilityItems) {
      const level = strOrNull(item.capability_level) ?? 'Unassigned';
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    const total = capabilityItems.length || 1;
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count], index) => ({
        label,
        count,
        percent: (count / total) * 100,
        color: LEVEL_COLORS[index % LEVEL_COLORS.length]!,
        onClick:
          label === 'Unassigned'
            ? undefined
            : () =>
                navigate({
                  to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID],
                  params: { workspaceSlug },
                  search: () => ({ level: label })
                })
      }));
  }, [capabilityItems, navigate, workspaceSlug]);

  const statusBuckets = useMemo<BarBucket[]>(() => {
    const counts = new Map<string, number>();
    for (const item of objectiveItems) {
      const status = strOrNull(item.status) ?? 'draft';
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    const total = objectiveItems.length || 1;
    const known = STATUS_ORDER.filter(status => counts.has(status));
    const extra = [...counts.keys()].filter(
      status => !STATUS_ORDER.includes(status as (typeof STATUS_ORDER)[number])
    );
    return [...known, ...extra].map(status => ({
      label: status,
      count: counts.get(status) ?? 0,
      percent: ((counts.get(status) ?? 0) / total) * 100,
      color: STATUS_COLOR[status] ?? 'var(--text-muted)',
      onClick: () =>
        navigate({
          to: STRATEGY_RAIL_PATHS[STRATEGY_STRATEGY_ID],
          params: { workspaceSlug }
        })
    }));
  }, [objectiveItems, navigate, workspaceSlug]);

  const coveredCapabilityIds = useMemo(
    () => new Set(capabilitySupportsEntity.data.map(relation => relation._in.id)),
    [capabilitySupportsEntity.data]
  );
  const coveredCount = capabilityItems.filter(item => coveredCapabilityIds.has(item._uid)).length;
  const coveragePercent =
    capabilityItems.length > 0 ? (coveredCount / capabilityItems.length) * 100 : 0;

  const linkedCapabilityIds = useMemo(
    () => new Set(objectiveSupportsCapability.data.map(relation => relation._out.id)),
    [objectiveSupportsCapability.data]
  );
  const orphanCount = capabilityItems.filter(item => !linkedCapabilityIds.has(item._uid)).length;

  const largestGaps = useMemo(() => {
    return capabilityItems
      .map(item => ({ item, gap: rollups.byId.get(item._uid)?.avgGap ?? null }))
      .filter((row): row is { item: (typeof capabilityItems)[number]; gap: number } => row.gap != null && row.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, GAP_TILE_LIMIT);
  }, [capabilityItems, rollups.byId]);

  const openCapability = (publicId: string) =>
    navigate({
      to: `${STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]}/$capabilityId`,
      params: { workspaceSlug, capabilityId: publicId },
      search: () => ({})
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading strategy model…</div>;
  }
  if (!strategyConfig) {
    return <div className={styles.empty}>Strategy model is not enabled.</div>;
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          title="Strategy & Capability Modelling"
          description="Capability, strategy, and coverage health at a glance — each tile links to the section behind it."
        />
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Capabilities</div>
          <div className={styles.tileValue}>{capabilityItems.length}</div>
          <StackedBar buckets={levelBuckets} />
          <div className={styles.legend}>
            {levelBuckets.map(bucket => (
              <button
                key={bucket.label}
                type="button"
                className={styles.legendItem}
                onClick={bucket.onClick}
                disabled={!bucket.onClick}
              >
                <span className={styles.swatch} style={{ background: bucket.color ?? undefined }} />
                {bucket.label} {bucket.count}
              </button>
            ))}
            {levelBuckets.length === 0 && <span className={styles.tileSub}>No capabilities yet.</span>}
          </div>
        </div>

        <div className={styles.tile}>
          <div className={styles.tileLabel}>Objectives</div>
          <div className={styles.tileValue}>{objectiveItems.length}</div>
          <StackedBar buckets={statusBuckets} />
          <div className={styles.legend}>
            {statusBuckets.map(bucket => (
              <button
                key={bucket.label}
                type="button"
                className={styles.legendItem}
                onClick={bucket.onClick}
              >
                <span className={styles.swatch} style={{ background: bucket.color ?? undefined }} />
                {bucket.label} {bucket.count}
              </button>
            ))}
            {statusBuckets.length === 0 && <span className={styles.tileSub}>No objectives yet.</span>}
          </div>
        </div>

        <button
          type="button"
          className={styles.tile}
          onClick={() =>
            navigate({
              to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID],
              params: { workspaceSlug }
            })
          }
        >
          <div className={styles.tileLabel}>Application coverage</div>
          <div className={styles.tileValue}>{formatPercent(coveragePercent)}</div>
          <div className={styles.tileSub}>
            {coveredCount} of {capabilityItems.length} capabilities have ≥1 application
          </div>
        </button>

        <button
          type="button"
          className={styles.tile}
          onClick={() =>
            navigate({
              to: STRATEGY_RAIL_PATHS[STRATEGY_TRACEABILITY_ID],
              params: { workspaceSlug },
              search: () => ({ tab: 'orphans' })
            })
          }
        >
          <div className={styles.tileLabel}>Orphan capabilities</div>
          <div className={styles.tileValue}>{orphanCount}</div>
          <div className={styles.tileSub}>no supporting objective</div>
        </button>
      </div>

      <Section title="Largest maturity gaps" sub="maturity target − maturity, rolled up over each capability's subtree">
        <Table.Root bordered={false}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Capability</Table.HeaderCell>
              <Table.HeaderCell numeric>Gap</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {largestGaps.length === 0 ? (
              <Table.EmptyRow colSpan={2}>
                {capabilities.isLoading || rollups.isLoading
                  ? 'Loading roll-ups…'
                  : 'Every capability is on or ahead of its maturity target.'}
              </Table.EmptyRow>
            ) : (
              largestGaps.map(({ item, gap }) => {
                const formatted = formatGap(gap);
                return (
                  <Table.Row key={item._uid} onClick={() => openCapability(item._publicId)}>
                    <Table.NameCell title={item._name} subtitle={item._publicId} />
                    <Table.Cell numeric className={formatted.className} style={formatted.style}>
                      {formatted.text}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </Section>
    </main>
  );
};
