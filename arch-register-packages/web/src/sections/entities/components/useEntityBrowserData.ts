import { useEffect, useMemo } from 'react';
import { useEntities, useEntityCount, useEntityFacets } from '../../../hooks/useEntities';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { BrowserEntityRecord } from './entityBrowserState';
import { parseDateValue } from './entityBrowserState';

type UseEntityBrowserDataProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  schemas: EntitySchema[];
  q: string;
  conditions: FilterCondition[];
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  sort: string;
  view: BrowserView;
  pageIndex: number;
  pageSize: number;
  disablePaging?: boolean;
  enabled?: boolean;
  asOf?: string;
  includeProjectSnapshots?: boolean;
  onCountChange?: (count: number) => void;
};

export const useEntityBrowserData = ({
  workspaceId,
  projectId,
  projectScope,
  schemas,
  q,
  conditions,
  typeFilter,
  ownerFilter,
  statusFilter,
  sort,
  view,
  pageIndex,
  pageSize,
  disablePaging = false,
  enabled = true,
  asOf,
  includeProjectSnapshots = true,
  onCountChange
}: UseEntityBrowserDataProps) => {
  const isPagedBrowse = !disablePaging && (view === 'table' || view === 'cards') && sort === 'name';
  const pagedOffset = pageIndex * pageSize;
  // While browsing a snapshot date, the "show all entities" toggle has no effect within a
  // project — only project-linked entities are ever shown.
  const effectiveProjectScope = asOf && projectId ? 'project' : projectScope;

  const {
    data: pagedEntities = [],
    isLoading: isPagedLoading,
    isFetching: isPagedFetching
  } = useEntities(
    workspaceId,
    {
      schemaId: typeFilter,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
      conditions,
      projectId: projectId ?? undefined,
      projectScope: projectId ? effectiveProjectScope : undefined,
      view: 'summary',
      limit: isPagedBrowse ? pageSize : undefined,
      offset: isPagedBrowse ? pagedOffset : undefined,
      asOf,
      includeProjectSnapshots
    },
    { enabled: enabled && isPagedBrowse && !!workspaceId }
  );

  const {
    data: fullEntities = [],
    isLoading: isFullLoading,
    isFetching: isFullFetching
  } = useEntities(
    workspaceId,
    {
      schemaId: typeFilter,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
      conditions,
      projectId: projectId ?? undefined,
      projectScope: projectId ? effectiveProjectScope : undefined,
      view: 'summary',
      asOf,
      includeProjectSnapshots
    },
    { enabled: enabled && !isPagedBrowse && !!workspaceId }
  );

  const entities = isPagedBrowse ? pagedEntities : fullEntities;
  const { data: facets } = useEntityFacets(workspaceId);
  const { data: entityCount } = useEntityCount(
    workspaceId,
    {
      schemaId: typeFilter,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
      conditions,
      projectId: projectId ?? undefined,
      projectScope: projectId ? effectiveProjectScope : undefined,
      asOf,
      includeProjectSnapshots
    },
    { enabled: enabled && !!workspaceId }
  );
  const schemaMap = useMemo(() => {
    const map = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((schema, index) => map.set(schema.id, { schema, index }));
    return map;
  }, [schemas]);

  const owners = useMemo(() => {
    if (projectId) {
      return [
        ...new Map(
          entities
            .filter(
              (entity): entity is BrowserEntityRecord & { _owner: { id: string; name: string } } =>
                entity._owner != null
            )
            .map(entity => [
              entity._owner.id,
              { id: entity._owner.id, name: entity._owner.name, sort_order: 0 }
            ])
        ).values()
      ];
    }

    return (facets?.owner ?? [])
      .filter(
        (bucket): bucket is typeof bucket & { value: string } =>
          bucket.value != null && bucket.value !== ''
      )
      .map((bucket, index) => ({
        id: bucket.value,
        name: bucket.label ?? bucket.value,
        sort_order: index
      }));
  }, [entities, facets, projectId]);

  const selectedSchema = typeFilter != null ? (schemaMap.get(typeFilter)?.schema ?? null) : null;
  const dateFields = useMemo(
    () =>
      selectedSchema?.fields.filter(
        (field): field is Extract<EntitySchema['fields'][number], { type: 'date' }> =>
          field.type === 'date'
      ) ?? [],
    [selectedSchema]
  );

  const sortOptions = useMemo(
    () => [
      { value: 'name', label: 'Name' },
      { value: 'type', label: 'Type' },
      { value: 'owner', label: 'Owner' },
      { value: 'completeness', label: 'Completeness' },
      ...(view === 'table'
        ? dateFields.map(field => ({ value: `date:${field.id}`, label: `${field.name} date` }))
        : [])
    ],
    [dateFields, view]
  );

  const activeDateFieldId = useMemo(() => {
    if (sort.startsWith('date:')) return sort.slice(5);
    return dateFields[0]?.id ?? null;
  }, [dateFields, sort]);
  const activeDateField = useMemo(
    () => dateFields.find(field => field.id === activeDateFieldId) ?? null,
    [dateFields, activeDateFieldId]
  );
  const dateBrowserEnabled = view === 'table' && selectedSchema != null && dateFields.length > 0;

  const filtered = useMemo<BrowserEntityRecord[]>(() => {
    const result = [...entities] as BrowserEntityRecord[];
    result.sort((a, b) => {
      if (sort === 'name') {
        return (a._name ?? a._slug ?? '').localeCompare(b._name ?? b._slug ?? '');
      }
      if (sort === 'type') return a._schema.id.localeCompare(b._schema.id);
      if (sort === 'owner') return (a._owner?.name ?? '').localeCompare(b._owner?.name ?? '');
      if (sort === 'completeness') return (a._completeness ?? -1) - (b._completeness ?? -1);
      if (dateBrowserEnabled && sort.startsWith('date:')) {
        const fieldId = sort.slice(5);
        const aValue = parseDateValue(a[fieldId]) ?? '9999-99-99';
        const bValue = parseDateValue(b[fieldId]) ?? '9999-99-99';
        return aValue.localeCompare(bValue);
      }
      return 0;
    });
    return result;
  }, [dateBrowserEnabled, entities, sort]);

  const filteredCount = filtered.length;
  const totalCount = entityCount?.total ?? filteredCount;
  const isLoading = isPagedBrowse ? isPagedLoading || isPagedFetching : isFullLoading || isFullFetching;

  useEffect(() => {
    onCountChange?.(totalCount);
  }, [onCountChange, totalCount]);

  return {
    activeDateField,
    dateFields,
    entities,
    filtered,
    filteredCount,
    isLoading,
    isPagedBrowse,
    owners,
    schemaMap,
    sortOptions,
    totalCount
  };
};
