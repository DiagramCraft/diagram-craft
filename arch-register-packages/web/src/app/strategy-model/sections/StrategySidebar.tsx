import { useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { useEntityTree } from '../../../hooks/useEntities';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { buildCapabilityTree, type CapabilityTreeItem } from '../capabilityTree';
import {
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_RAIL_PATHS,
  STRATEGY_SECTIONS,
  type StrategyRailItemId
} from '../strategySections';
import type { CapabilitiesSearchParams } from '../../../routes/searchParams';
import styles from '../../../shell/SidePanel.module.css';

const CapabilityTreeRow = ({
  item,
  depth,
  activeId,
  expandedIds,
  onToggle,
  onSelect
}: {
  item: CapabilityTreeItem;
  depth: number;
  activeId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) => {
  const expanded = expandedIds.has(item._uid);
  const hasChildren = item.children.length > 0;
  return (
    <>
      <TreeRow
        depth={depth}
        label={item._name}
        testId={`strategy-capability-tree-${item._uid}`}
        active={activeId === item._uid}
        expandable={hasChildren}
        expanded={expanded}
        onExpand={() => onToggle(item._uid)}
        onClick={() => onSelect(item._uid)}
      />
      {expanded &&
        item.children.map(child => (
          <CapabilityTreeRow
            key={child._uid}
            item={child}
            depth={depth + 1}
            activeId={activeId}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
};

/**
 * The Capabilities section's own primary-sidebar content: a capability tree (clicking a node
 * filters the Capabilities table to that subtree, via the `subtreeOf` search param) plus an
 * owner facet, replacing the plain "Sections" nav list for this section only — the app's five
 * sections are already switchable via the outer `NavRail` icon bar
 * (`layouts/WorkspaceLayout.tsx`), so this list was always a secondary nav, not the only one.
 */
const CapabilitiesSidebarContent = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as CapabilitiesSearchParams;
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations);
  const businessCapabilitySchemaId = strategyConfig?.businessCapabilitySchemaId ?? null;

  const { data: treeData } = useEntityTree(
    workspaceSlug,
    { schemaId: businessCapabilitySchemaId ?? undefined },
    businessCapabilitySchemaId != null
  );
  // Only owner id/name is needed for the facet counts below, so this stays on the cheaper
  // 'summary' view rather than `StrategyCapabilitiesScreen`'s 'full' fetch (needed there for
  // `capability_level`) — the two don't share a query-cache entry. Undercounted beyond `limit`
  // items, same caveat as `GlossarySidebar`'s category counts.
  const { data: capabilitiesData } = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: businessCapabilitySchemaId, view: 'summary', limit: 1000 },
      businessCapabilitySchemaId != null
    )
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpandedIds(previous => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const tree = useMemo(
    () => buildCapabilityTree(treeData?.nodes ?? [], treeData?.edges ?? []),
    [treeData]
  );

  const capabilities = capabilitiesData?.items ?? [];
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const capability of capabilities) {
      if (!capability._owner) continue;
      const entry = counts.get(capability._owner.id) ?? { name: capability._owner.name, count: 0 };
      entry.count++;
      counts.set(capability._owner.id, entry);
    }
    return counts;
  }, [capabilities]);

  const patchSearch = (patch: Partial<CapabilitiesSearchParams>) =>
    navigate({
      to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const selectSubtree = (id: string) =>
    patchSearch({ subtreeOf: search.subtreeOf === id ? undefined : id });

  const toggleOwner = (id: string) =>
    patchSearch({ owner: search.owner === id ? undefined : id });

  return (
    <>
      <TreeRow
        label="All capabilities"
        testId="strategy-capability-tree-all"
        active={!search.subtreeOf}
        onClick={() => patchSearch({ subtreeOf: undefined })}
        trailing={<span className="dim mono">{capabilities.length}</span>}
      />
      <SidebarGroupLabel>Owner</SidebarGroupLabel>
      {[...ownerCounts.entries()].map(([ownerId, { name, count }]) => (
        <TreeRow
          key={ownerId}
          label={name}
          testId={`strategy-capability-owner-${ownerId}`}
          active={search.owner === ownerId}
          onClick={() => toggleOwner(ownerId)}
          trailing={<span className="dim mono">{count}</span>}
        />
      ))}
      {ownerCounts.size === 0 && <div className={`${styles.emptyState} dim`}>No owners assigned.</div>}
      <SidebarGroupLabel>Hierarchy</SidebarGroupLabel>
      {tree.length === 0 ? (
        <div className={`${styles.emptyState} dim`}>No capabilities yet.</div>
      ) : (
        tree.map(item => (
          <CapabilityTreeRow
            key={item._uid}
            item={item}
            depth={0}
            activeId={search.subtreeOf ?? null}
            expandedIds={expandedIds}
            onToggle={toggle}
            onSelect={selectSubtree}
          />
        ))
      )}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Strategy & Capability Modelling app: navigation
 * between the app's five rail sections, gated on the `strategy-model` capability configuration
 * (mirrors `../../business-glossary/sections/GlossarySidebar.tsx`'s `!enabled` empty state). The
 * Capabilities section replaces this nav list with its own tree+facet content (see
 * `CapabilitiesSidebarContent` above).
 */
export const StrategySidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: StrategyRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveStrategyModelConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="Strategy" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Strategy model is not enabled.</div>
        ) : activeSection === STRATEGY_CAPABILITIES_ID ? (
          <CapabilitiesSidebarContent workspaceSlug={workspaceSlug} />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {STRATEGY_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`strategy-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: STRATEGY_RAIL_PATHS[section.id],
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
