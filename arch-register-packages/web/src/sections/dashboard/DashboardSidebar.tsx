import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardFacetConfig,
  DashboardSidebarConfig
} from '@arch-register/api-types/dashboardContract';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import { entitiesQuery } from '../../queries/entities';
import { useSchemas } from '../../hooks/useSchemas';
import styles from '../../shell/SidePanel.module.css';
import { facetKindForField } from './dashboardFacetFields';

type Props = {
  workspaceSlug: string;
  sidebar: DashboardSidebarConfig;
  title: string;
};

/** Fixed sample size for client-side facet tallies — mirrors GlossarySidebar's capped-fetch
 *  approach: there's no server-side "count entities by referenced value of field X" endpoint, so
 *  workspaces with more entities than this on the faceted schema will show undercounted facets.
 *  Known, accepted limitation, not something this component tries to fix. */
const FACET_SAMPLE_LIMIT = 200;

/** Narrow shape shared by `_owner`/`_lifecycle` and by a resolved reference-field value. */
type ForeignKey = { id: string; name: string };

const isForeignKey = (value: unknown): value is ForeignKey =>
  value !== null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string';

/** Normalizes a raw entity field value into a flat list of referenced ids. A reference field's
 *  value may be a single id/object or an array of them depending on its cardinality; `_owner` and
 *  `_lifecycle` are always a single nullable foreign-key object. */
const asFacetValueIds = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => {
    if (item == null) return [];
    if (typeof item === 'string') return [item];
    if (isForeignKey(item)) return [item.id];
    return [];
  });
};

const FacetCheckboxRow = ({
  label,
  testId,
  checked,
  onToggle,
  count
}: {
  label: string;
  testId: string;
  checked: boolean;
  onToggle: () => void;
  count: number;
}) => (
  <TreeRow
    testId={testId}
    label={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Filter by ${label}`}
          onChange={onToggle}
          onClick={event => event.stopPropagation()}
          style={{ margin: 0 }}
        />
        <span>{label}</span>
      </span>
    }
    active={checked}
    onClick={onToggle}
    trailing={<span className="dim mono">{count}</span>}
    hideIconSlot
  />
);

/**
 * One `facets` sidebar section: either a reference field (counts tallied against the referenced
 * schema's entities) or a standard `_owner`/`_lifecycle` field (counts tallied against the
 * faceted schema's own entities).
 */
const FacetSection = ({
  workspaceSlug,
  schemaId,
  facet,
  selectedIds,
  onToggle
}: {
  workspaceSlug: string;
  schemaId: string | undefined;
  facet: DashboardFacetConfig;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) => {
  // Any non-`_` facet is a schema field matched by display name: a reference field (tallied
  // against the referenced schema's entities), a select field (labels from its options) or a
  // text field (the raw values double as labels).
  const isFieldFacet = !facet.fieldId.startsWith('_');

  // For a reference facet, `facet.fieldId` is the field's display NAME (e.g. "Categories"), not
  // its id — a schema template's field id is workspace-specific (resolved via capability
  // field-role binding when the schema is instantiated, see `glossaryOperations.ts`'s
  // `resolveCapabilityFieldId`), so it can't be seeded as a fixed id, only matched by name at
  // render time (mirrors `schemaName` on this same config and on `entity-picker`). `_owner` /
  // `_lifecycle` are stable meta-field ids and pass through unchanged.
  const schemas = useSchemas(workspaceSlug);
  const { resolvedFieldId, targetSchemaId, selectOptions } = useMemo(() => {
    if (!isFieldFacet) {
      return {
        resolvedFieldId: facet.fieldId,
        targetSchemaId: undefined,
        selectOptions: undefined
      };
    }
    if (!schemaId) {
      return { resolvedFieldId: undefined, targetSchemaId: undefined, selectOptions: undefined };
    }
    const schema = schemas.data?.find(candidate => candidate.id === schemaId);
    const field = schema?.fields.find(candidate => candidate.name === facet.fieldId);
    return {
      resolvedFieldId: field?.id,
      targetSchemaId:
        field && facetKindForField(field) === 'reference' && 'schemaId' in field
          ? field.schemaId
          : undefined,
      selectOptions:
        field && facetKindForField(field) === 'select' && 'options' in field
          ? field.options
          : undefined
    };
  }, [isFieldFacet, schemas.data, schemaId, facet.fieldId]);

  // Capped sample of the faceted schema's own entities, used to tally this facet's counts
  // client-side (see FACET_SAMPLE_LIMIT).
  const sample = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId, view: 'full', limit: FACET_SAMPLE_LIMIT },
      !!schemaId && !!resolvedFieldId
    )
  );
  const sampledItems = sample.data?.items ?? [];

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    if (!resolvedFieldId) return tally;
    for (const entity of sampledItems) {
      const raw = (entity as unknown as Record<string, unknown>)[resolvedFieldId];
      for (const id of asFacetValueIds(raw)) {
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
    }
    return tally;
  }, [sampledItems, resolvedFieldId]);

  // Reference facet: fetch the target schema's entities for their display names. Select facet:
  // labels come from the field's options. Text / standard-field facet: labels come straight off
  // the sampled values (`_owner`/`_lifecycle` foreign keys, or the raw text itself).
  const targetEntities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: targetSchemaId, view: 'summary', limit: 500 },
      !!targetSchemaId
    )
  );

  const options = useMemo(() => {
    if (targetSchemaId) {
      return (targetEntities.data?.items ?? [])
        .filter(entity => counts.has(entity._uid))
        .map(entity => ({ id: entity._uid, label: entity._name }));
    }
    const labels = new Map<string, string>(
      (selectOptions ?? []).map(option => [option.value, option.label])
    );
    if (resolvedFieldId) {
      for (const entity of sampledItems) {
        const value = (entity as unknown as Record<string, unknown>)[resolvedFieldId];
        if (isForeignKey(value)) labels.set(value.id, value.name);
      }
    }
    return Array.from(counts.keys()).map(id => ({ id, label: labels.get(id) ?? id }));
  }, [targetSchemaId, targetEntities.data, counts, sampledItems, resolvedFieldId, selectOptions]);

  const sorted = useMemo(
    () => [...options].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)),
    [options, counts]
  );

  return (
    <>
      {facet.itemLabel && <SidebarGroupLabel>{facet.itemLabel}</SidebarGroupLabel>}
      {sorted.map(option => (
        <FacetCheckboxRow
          key={option.id}
          label={option.label}
          testId={`dashboard-sidebar-facet-${facet.variableName}-${option.id}`}
          checked={selectedIds.has(option.id)}
          onToggle={() => onToggle(option.id)}
          count={counts.get(option.id) ?? 0}
        />
      ))}
    </>
  );
};

const FacetsSidebar = ({
  workspaceSlug,
  sidebar,
  title
}: {
  workspaceSlug: string;
  sidebar: Extract<DashboardSidebarConfig, { kind: 'facets' }>;
  title: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const schemas = useSchemas(workspaceSlug);
  const schemaId = schemas.data?.find(schema => schema.name === sidebar.schemaName)?.id;

  const selectedByVariable = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const facet of sidebar.facets) {
      const raw = search[facet.variableName];
      const ids = typeof raw === 'string' ? raw.split(',').filter(Boolean) : [];
      map.set(facet.variableName, new Set(ids));
    }
    return map;
  }, [sidebar.facets, search]);

  const toggle = (variableName: string, id: string) => {
    const current = selectedByVariable.get(variableName) ?? new Set<string>();
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const joined = [...next].join(',');
    navigate({
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [variableName]: joined || undefined
      })
    } as Parameters<typeof navigate>[0]);
  };

  return (
    <>
      <SidebarTitleHeader title={title} />
      <div className={styles.scroll}>
        {sidebar.facets.map(facet => (
          <FacetSection
            key={facet.variableName}
            workspaceSlug={workspaceSlug}
            schemaId={schemaId}
            facet={facet}
            selectedIds={selectedByVariable.get(facet.variableName) ?? new Set()}
            onToggle={id => toggle(facet.variableName, id)}
          />
        ))}
      </div>
    </>
  );
};

const EntityPickerSidebar = ({
  workspaceSlug,
  sidebar,
  title
}: {
  workspaceSlug: string;
  sidebar: Extract<DashboardSidebarConfig, { kind: 'entity-picker' }>;
  title: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const selected = search[sidebar.variableName];

  const schemas = useSchemas(workspaceSlug);
  const schema = schemas.data?.find(candidate => candidate.name === sidebar.schemaName);
  const schemaId = schema?.id;

  const entities = useQuery(
    entitiesQuery(workspaceSlug, { schemaId, limit: 500 }, schemaId != null)
  );
  const items = entities.data?.items ?? [];
  const sorted = useMemo(() => [...items].sort((a, b) => a._name.localeCompare(b._name)), [items]);

  const selectionValue = (entity: (typeof items)[number]) =>
    sidebar.valueKind === 'id' ? entity._uid : entity._publicId;

  // Re-selecting the active item clears the selection.
  const toggle = (value: string) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [sidebar.variableName]: selected === value ? undefined : value
      })
    } as Parameters<typeof navigate>[0]);

  return (
    <>
      <SidebarTitleHeader title={title} />
      <div className={styles.scroll}>
        {sidebar.itemLabel && <SidebarGroupLabel>{sidebar.itemLabel}</SidebarGroupLabel>}
        {!entities.isLoading &&
          sorted.map(entity => (
            <TreeRow
              key={entity._uid}
              icon={<TypeBadge color="currentColor" icon={schema?.icon} size={14} hideBorder />}
              label={entity._name}
              testId={`dashboard-sidebar-item-${entity._uid}`}
              active={selected === selectionValue(entity)}
              onClick={() => toggle(selectionValue(entity))}
            />
          ))}
      </div>
    </>
  );
};

const OptionsSidebar = ({
  sidebar,
  title
}: {
  sidebar: Extract<DashboardSidebarConfig, { kind: 'options' }>;
  title: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const raw = search[sidebar.variableName];
  const selected = typeof raw === 'string' ? raw : undefined;

  const select = (value: string | undefined) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [sidebar.variableName]: value
      })
    } as Parameters<typeof navigate>[0]);

  return (
    <>
      <SidebarTitleHeader title={title} />
      <div className={styles.scroll}>
        {sidebar.allLabel && (
          <TreeRow
            label={sidebar.allLabel}
            testId={`dashboard-sidebar-option-${sidebar.variableName}-all`}
            active={selected === undefined}
            onClick={() => select(undefined)}
            hideIconSlot
          />
        )}
        {sidebar.itemLabel && <SidebarGroupLabel>{sidebar.itemLabel}</SidebarGroupLabel>}
        {sidebar.options.map(option => (
          <TreeRow
            key={option.value}
            label={option.label}
            testId={`dashboard-sidebar-option-${sidebar.variableName}-${option.value}`}
            active={selected === option.value}
            // Re-selecting the active option clears the selection.
            onClick={() => select(selected === option.value ? undefined : option.value)}
            hideIconSlot
          />
        ))}
      </div>
    </>
  );
};

/**
 * A dashboard's optional selection sidebar. Supports three kinds:
 * - `entity-picker`: a plain list of a schema's entities, single-select — mirroring the shape of
 *   the API & Integration Catalog Impact section's former bespoke `ImpactSidebarContent`.
 * - `facets`: one or more independent multi-select facet lists over one schema's entities, each
 *   backed by either a reference field or a standard `_owner`/`_lifecycle` field (#3467 follow-up,
 *   prep work for migrating the Business Glossary screen onto the dashboard system).
 *
 * - `options`: a single-select list of fixed value/label pairs configured on the sidebar itself
 *   (e.g. a status filter) — no entity lookup, so no counts.
 *
 * All kinds keep their selection as URL state, keyed by each variable's `variableName` — a single
 * id for `entity-picker`, a comma-joined list of ids for each `facets` facet, the option value for
 * `options` — exactly like every
 * other per-app sidebar in this app. `AppDashboardScreen` reads the same params to populate
 * `DashboardSidebarContext`, which widget config strings reference via
 * `resolveSidebarVariableReferences`.
 */
export const DashboardSidebar = ({ workspaceSlug, sidebar, title }: Props) => {
  if (sidebar.kind === 'facets') {
    return <FacetsSidebar workspaceSlug={workspaceSlug} sidebar={sidebar} title={title} />;
  }
  if (sidebar.kind === 'options') {
    return <OptionsSidebar sidebar={sidebar} title={title} />;
  }
  return <EntityPickerSidebar workspaceSlug={workspaceSlug} sidebar={sidebar} title={title} />;
};
