import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbSearch } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { useEntityTree } from '../../../hooks/useEntities';
import { entitiesQuery } from '../../../queries/entities';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { useCapabilityRollups, type CapabilityTableRollup } from '../useCapabilityRollups';
import {
  CAPABILITY_MAP_OVERLAYS,
  overlayColor,
  overlayValue,
  type CapabilityMapOverlay
} from '../capabilityMapOverlays';
import { CapabilityDrawer } from './CapabilityDrawer';
import { STRATEGY_CAPABILITY_MAP_ID, STRATEGY_RAIL_PATHS } from '../strategySections';
import type { CapabilityMapSearchParams } from '../../../routes/searchParams';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './StrategyCapabilityMapScreen.module.css';

const EMPTY_ROLLUP: CapabilityTableRollup = {
  avgMaturity: null,
  avgMaturityTarget: null,
  avgGap: null,
  avgRisk: null,
  sumAnnualInvestment: null,
  investmentCurrencyCode: null,
  appsCount: null
};

const MAP_ROUTE = STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID];

export const StrategyCapabilityMapScreen = () => {
  const { workspaceSlug, capabilityId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    capabilityId?: string;
  };
  const search = useSearch({ strict: false }) as CapabilityMapSearchParams;
  const navigate = useNavigate();

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);
  const businessCapabilitySchemaId = strategyConfig?.businessCapabilitySchemaId ?? null;

  // `view: 'full'` — the grid reads the derived `capability_level` and the own maturity/investment/
  // risk fields (leaf fallback in `useCapabilityRollups`), which the 'summary' projection omits.
  // Same reasoning as `StrategyCapabilitiesScreen`.
  const capabilities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: businessCapabilitySchemaId, view: 'full', limit: 1000 },
      businessCapabilitySchemaId != null
    )
  );
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: businessCapabilitySchemaId ?? undefined },
    businessCapabilitySchemaId != null
  );

  const items = useMemo(() => capabilities.data?.items ?? [], [capabilities.data]);
  const byUid = useMemo(() => new Map(items.map(c => [c._uid, c])), [items]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { parentId, childId } of tree.data?.edges ?? []) {
      map.set(parentId, [...(map.get(parentId) ?? []), childId]);
    }
    return map;
  }, [tree.data]);

  const childCaps = (uid: string): EntityRecord[] =>
    (childrenOf.get(uid) ?? [])
      .map(id => byUid.get(id))
      .filter((c): c is EntityRecord => c != null)
      .sort((a, b) => a._name.localeCompare(b._name));

  const rootCaps = useMemo(() => {
    const childIds = new Set((tree.data?.edges ?? []).map(e => e.childId));
    return items.filter(c => !childIds.has(c._uid)).sort((a, b) => a._name.localeCompare(b._name));
  }, [items, tree.data]);

  const rollups = useCapabilityRollups(
    workspaceSlug,
    businessCapabilitySchemaId,
    strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId ?? null,
    items,
    tree.data?.edges ?? []
  );
  const rollupFor = (uid: string) => rollups.byId.get(uid) ?? EMPTY_ROLLUP;

  const [query, setQuery] = useState('');
  const [overlay, setOverlay] = useState<CapabilityMapOverlay>('none');
  const overlayDef = CAPABILITY_MAP_OVERLAYS.find(o => o.id === overlay);
  const overlayLegend = overlayDef?.legend ?? [];

  const q = query.trim().toLowerCase();
  const owner = search.owner ?? null;
  const matches = (cap: EntityRecord) =>
    (!owner || cap._owner?.id === owner) && (!q || cap._name.toLowerCase().includes(q));

  const focusCap = search.focus ? (byUid.get(search.focus) ?? null) : null;
  const domains = focusCap ? [focusCap] : rootCaps;

  const patchSearch = (patch: Partial<CapabilityMapSearchParams>) =>
    navigate({
      to: capabilityId ? `${MAP_ROUTE}/$capabilityId` : MAP_ROUTE,
      params: { workspaceSlug, ...(capabilityId ? { capabilityId } : {}) },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openCapability = (id: string) =>
    navigate({
      to: `${MAP_ROUTE}/$capabilityId`,
      params: { workspaceSlug, capabilityId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeCapability = () =>
    navigate({
      to: MAP_ROUTE,
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  const focusDomain = (uid: string) =>
    patchSearch({ focus: search.focus === uid ? undefined : uid });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading strategy model…</div>;
  }
  if (!strategyConfig) {
    return (
      <div className={styles.empty}>
        The strategy model is not enabled. Configure the strategy model capability in workspace
        settings.
      </div>
    );
  }

  const renderLeaf = (cap: EntityRecord) => {
    const rollup = rollupFor(cap._uid);
    const heat = overlay === 'none' ? undefined : overlayColor(overlay, rollup);
    const value = overlay === 'none' ? null : overlayValue(overlay, rollup);
    return (
      <button
        key={cap._uid}
        type="button"
        className={`${styles.leaf} ${matches(cap) ? '' : styles.leafDim}`}
        style={heat ? ({ '--heat': heat } as React.CSSProperties) : undefined}
        onClick={() => openCapability(cap._publicId)}
        title={cap._name}
      >
        <span className={styles.dot} style={heat ? { background: heat } : undefined} />
        <span className={styles.leafName}>{cap._name}</span>
        {value != null && <span className={`${styles.leafValue} mono tabular`}>{value}</span>}
      </button>
    );
  };

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          title="Capability map"
          chips={!capabilities.isLoading && <span className={styles.count}>{items.length}</span>}
          description="Business Capability model over its containment hierarchy. Records are edited on the entity."
        />
      </div>

      <div className={filterStyles.toolbar}>
        <div className={styles.search}>
          <TbSearch size={12} />
          <input
            placeholder="Find a capability…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <FilterDropdown
          label="Overlay"
          value={overlay}
          onChange={value => setOverlay(value as CapabilityMapOverlay)}
          options={CAPABILITY_MAP_OVERLAYS.map(o => ({ value: o.id, label: o.label }))}
        />
        {focusCap && (
          <Button size="sm" variant="ghost" onClick={() => patchSearch({ focus: undefined })}>
            ‹ All domains
          </Button>
        )}
        {overlayLegend.length > 0 && (
          <div className={styles.legend} style={{ marginLeft: 'auto' }}>
            {overlayLegend.map((label, band) => (
              <span key={label} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{
                    background: ['var(--green)', 'var(--warning-fg)', 'var(--error-fg, #e05252)'][
                      band
                    ]
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={`${styles.map} ${focusCap ? styles.mapFocused : ''}`}>
        {domains.length === 0 ? (
          <div className={styles.empty}>
            {capabilities.isLoading || tree.isLoading
              ? 'Loading capabilities…'
              : 'No capabilities yet.'}
          </div>
        ) : (
          domains.map(domain => {
            const roll = rollupFor(domain._uid);
            const l2s = childCaps(domain._uid);
            // With an overlay active the header echoes that dimension's rolled-up value (and
            // colour); with no overlay it falls back to investment + maturity.
            const overlaid = overlay !== 'none' ? overlayValue(overlay, roll) : null;
            const meta =
              overlay !== 'none'
                ? overlaid == null
                  ? null
                  : `${overlayDef?.label ?? ''} ${overlaid}`
                : roll.avgMaturity == null && roll.sumAnnualInvestment == null
                  ? null
                  : `${
                      roll.sumAnnualInvestment == null
                        ? '—'
                        : formatCurrencyValue({
                            amount: roll.sumAnnualInvestment,
                            currency: roll.investmentCurrencyCode
                          })
                    }/yr · mat ${roll.avgMaturity?.toFixed(1) ?? '—'}`;
            // Only the good/bad dimensions tint the header value; investment and coverage are
            // counts with no "better" direction, so their header stays the neutral text colour
            // (the tiles are still heat-banded — that's the overlay's job).
            const metaColor =
              overlay === 'maturity' || overlay === 'gap' || overlay === 'risk'
                ? overlayColor(overlay, roll)
                : undefined;
            return (
              <section key={domain._uid} className={styles.domain}>
                <header className={styles.domainHead}>
                  <span className={styles.dot} />
                  <button
                    type="button"
                    className={styles.domainName}
                    onClick={() =>
                      focusCap ? openCapability(domain._publicId) : focusDomain(domain._uid)
                    }
                  >
                    {domain._name}
                  </button>
                  {meta && (
                    <span
                      className={`${styles.domainMeta} mono tabular`}
                      style={metaColor ? { color: metaColor } : undefined}
                    >
                      {meta}
                    </span>
                  )}
                </header>
                {l2s.length > 0 && (
                  <div className={styles.l2row}>
                    {l2s.map(sub => {
                      const leaves = childCaps(sub._uid);
                      return (
                        <div key={sub._uid} className={styles.l2}>
                          <button
                            type="button"
                            className={styles.l2Head}
                            onClick={() => openCapability(sub._publicId)}
                          >
                            <span className={`${styles.dot} ${styles.dotSm}`} />
                            <span className={styles.l2Name}>{sub._name}</span>
                          </button>
                          <div className={styles.l3col}>
                            {leaves.length > 0 ? leaves.map(renderLeaf) : renderLeaf(sub)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

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
