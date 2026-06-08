import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import styles from './EntityBrowserScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import { Chip } from '../../components/Chip';
import {
  TbSearch,
  TbDownload,
  TbUpload,
  TbPlus,
  TbList,
  TbLayoutGrid,
  TbBinaryTree2,
  TbChevronDown,
  TbChevronRight,
  TbDots,
  TbUsers,
  TbCopy,
  TbTrash,
  TbChartRadar,
  TbCalendarWeek,
  TbCheck,
  TbX,
  TbFilter
} from 'react-icons/tb';
import { RadarView, type RadarConfig } from './components/RadarView';
import { TimelineView, type TimelineConfig } from './components/TimelineView';
import { resolveSchemaColor, exportEntitiesToCSV } from '../../lib/api';
import type {
  EntityRecord,
  EntitySchema,
  TreeNode,
  TreeEdge,
  WorkspaceLifecycleState
} from '../../lib/api';
import type { FilterCondition } from '@arch-register/api-types/views';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { FilterBuilder } from '../../components/FilterBuilder';
import {
  useEntities,
  useEntityFacets,
  useEntityTree,
  useDeleteEntity,
  useCloneEntity,
  useUpdateEntity,
  useCreateSavedView,
  useSavedViews,
  useUpdateSavedView
} from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

type BrowserView = 'table' | 'cards' | 'tree' | 'radar' | 'timeline';
type DateFilterOperator = 'on' | 'before' | 'after' | 'empty';

const parseDateValue = (value: unknown) => {
  if (typeof value !== 'string' || value === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const formatDateValue = (value: unknown) => {
  const parsed = parseDateValue(value);
  if (parsed == null) return '—';
  const date = new Date(`${parsed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? parsed : date.toLocaleDateString();
};

const matchesDateFilter = (value: unknown, operator: DateFilterOperator, expected: string) => {
  const parsed = parseDateValue(value);
  if (operator === 'empty') return parsed == null;
  if (parsed == null || expected === '') return true;
  switch (operator) {
    case 'on':
      return parsed === expected;
    case 'before':
      return parsed < expected;
    case 'after':
      return parsed > expected;
  }
};

type BulkEditToolbarProps = {
  selectedIds: Set<string>;
  bulkConfirming: boolean;
  setBulkConfirming: (value: boolean) => void;
  bulkLifecycleValue: string;
  setBulkLifecycleValue: (value: string) => void;
  bulkOwnerValue: string;
  setBulkOwnerValue: (value: string) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: { id: string }[];
  onClear: () => void;
  onConfirm: () => void;
};

const BulkEditToolbar = ({
  selectedIds,
  bulkConfirming,
  setBulkConfirming,
  bulkLifecycleValue,
  setBulkLifecycleValue,
  bulkOwnerValue,
  setBulkOwnerValue,
  lifecycleStates,
  teams,
  onClear,
  onConfirm
}: BulkEditToolbarProps) => (
  <div className={styles.bulkBar + (bulkConfirming ? ` ${styles.bulkBarConfirm}` : '')}>
    {!bulkConfirming ? (
      <>
        <span className={styles.bulkCount}>
          <span className={styles.bulkCountPill}>
            <TbCheck size={9} />
            <span>{selectedIds.size}</span>
          </span>
          <span className={styles.bulkCountLabel}>
            {selectedIds.size === 1 ? 'entity' : 'entities'} selected
          </span>
        </span>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Set lifecycle</span>
          <Select.Root
            value={bulkLifecycleValue}
            placeholder="No Change"
            onChange={v => setBulkLifecycleValue(v ?? '')}
          >
            {lifecycleStates.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.label}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Reassign owner</span>
          <Select.Root
            value={bulkOwnerValue}
            placeholder="No Change"
            onChange={v => setBulkOwnerValue(v ?? '')}
          >
            {teams.map(t => (
              <Select.Item key={t.id} value={t.id}>
                {t.id}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div style={{ flex: 1 }} />

        {(bulkLifecycleValue || bulkOwnerValue) && (
          <Button size="sm" variant="primary" onClick={() => setBulkConfirming(true)}>
            Review changes
          </Button>
        )}

        <Button size={'sm'} variant={'secondary'} onClick={onClear}>
          <TbX size={11} />
          <span>Clear</span>
        </Button>
      </>
    ) : (
      <>
        <div className={styles.bulkConfirmMsg}>
          <span className={styles.bulkWarnIcon}>!</span>
          <span>
            {bulkLifecycleValue && (
              <>
                <span className={styles.bulkDim}>Set lifecycle →</span>{' '}
                <b>
                  {lifecycleStates.find(s => s.id === bulkLifecycleValue)?.label ??
                    bulkLifecycleValue}
                </b>
              </>
            )}
            {bulkLifecycleValue && bulkOwnerValue && <span className={styles.bulkDim}> · </span>}
            {bulkOwnerValue && (
              <>
                <span className={styles.bulkDim}>Reassign owner →</span> <b>{bulkOwnerValue}</b>
              </>
            )}
            <span className={styles.bulkDim}> for </span>
            <b>{selectedIds.size}</b>
            <span className={styles.bulkDim}>
              {' '}
              {selectedIds.size === 1 ? 'entity' : 'entities'}
            </span>
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="primary" onClick={onConfirm}>
          Confirm
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkConfirming(false)}>
          Cancel
        </Button>
      </>
    )}
  </div>
);

const SaveViewDialog = ({
  open,
  onClose,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    onSave(name, description);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save current view as"
      sub="Save your current filters and view configuration to access them quickly later."
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onClose },
        { label: 'Save view', type: 'default', onClick: handleSave, disabled: !name.trim() }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormElement label="Name">
          <TextInput
            value={name}
            onChange={v => setName(v ?? '')}
            placeholder="e.g. Production components"
            autoFocus
          />
        </FormElement>
        <FormElement label="Description (optional)">
          <TextArea
            value={description}
            onChange={v => setDescription(v ?? '')}
            placeholder="What this view shows…"
          />
        </FormElement>
      </div>
    </Dialog>
  );
};

const toSavedViewConfig = (
  view: BrowserView,
  radarConfig: RadarConfig | null,
  timelineConfig: TimelineConfig | null
) => {
  if (view === 'radar' && radarConfig) return { radar: radarConfig };
  if (view === 'timeline' && timelineConfig) return { timeline: timelineConfig };
  return null;
};

export const EntityBrowserScreen = () => {
  const navigate = useNavigate();
  const {
    workspaceSlug,
    schemas,
    enums,
    lifecycleStates,
    teams,
    permissions,
    openAddEntityDialog
  } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as {
    type?: string;
    status?: string;
    owner?: string;
    q?: string;
    viewId?: string;
    viewMode?: BrowserView;
    radarConfig?: string;
    timelineConfig?: string;
    sidebarTab?: 'filters' | 'views';
    filters?: string;
  };
  const workspaceId = workspaceSlug;
  const [q, setQ] = useState(search.q ?? '');
  const [conditions, setConditions] = useState<FilterCondition[]>(() => {
    if (search.filters) {
      try {
        return JSON.parse(search.filters);
      } catch {
        return [];
      }
    }
    // Backward compatibility for old search params
    const initial: FilterCondition[] = [];
    if (search.type) initial.push({ fieldId: '_schemaId', op: 'equals', value: search.type });
    if (search.status) initial.push({ fieldId: '_lifecycle', op: 'equals', value: search.status });
    if (search.owner) initial.push({ fieldId: '_owner', op: 'equals', value: search.owner });
    return initial;
  });

  const typeFilter = useMemo(
    () =>
      (conditions.find(c => c.fieldId === '_schemaId' && c.op === 'equals')?.value as string) ??
      null,
    [conditions]
  );
  const statusFilter = useMemo(
    () =>
      (conditions.find(c => c.fieldId === '_lifecycle' && c.op === 'equals')?.value as string) ??
      null,
    [conditions]
  );
  const ownerFilter = useMemo(
    () =>
      (conditions.find(c => c.fieldId === '_owner' && c.op === 'equals')?.value as string) ?? null,
    [conditions]
  );

  const viewId = search.viewId ?? null;
  const [sort, setSort] = useState('name');
  const [view, setView] = useState<BrowserView>(search.viewMode ?? 'table');
  const [radarConfig, setRadarConfig] = useState<RadarConfig | null>(() => {
    if (search.radarConfig) {
      try {
        return JSON.parse(search.radarConfig);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig | null>(() => {
    if (search.timelineConfig) {
      try {
        return JSON.parse(search.timelineConfig);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkLifecycleValue, setBulkLifecycleValue] = useState('');
  const [bulkOwnerValue, setBulkOwnerValue] = useState('');
  const [isSavingView, setIsSavingView] = useState(false);
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  // Sync view from search params when it changes (e.g. applying a saved view)
  useEffect(() => {
    if (search.viewMode) setView(search.viewMode);
    if (search.q !== undefined) setQ(search.q);
    if (search.filters) {
      try {
        setConditions(JSON.parse(search.filters));
      } catch {
        // ignore
      }
    } else {
      setConditions([]);
    }
    if (search.radarConfig) {
      try {
        setRadarConfig(JSON.parse(search.radarConfig));
      } catch {
        // ignore
      }
    }
    if (search.timelineConfig) {
      try {
        setTimelineConfig(JSON.parse(search.timelineConfig));
      } catch {
        // ignore
      }
    }
  }, [search.viewMode, search.radarConfig, search.timelineConfig, search.q, search.filters]);

  // Use TanStack Query hooks for data fetching
  const { data: entities = [] } = useEntities(workspaceId, {
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q,
    view: 'summary'
  });

  const { data: facets } = useEntityFacets(workspaceId);
  const { data: savedViews = [] } = useSavedViews(workspaceId);

  const { data: treeData } = useEntityTree(workspaceId, {
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q
  });

  const treeNodes = treeData?.nodes ?? [];
  const treeEdges = treeData?.edges ?? [];

  // Mutations for delete, clone, and update
  const deleteMutation = useDeleteEntity(workspaceId);
  const cloneMutation = useCloneEntity(workspaceId);
  const updateEntityMutation = useUpdateEntity(workspaceId);
  const createSavedViewMutation = useCreateSavedView(workspaceId);
  const updateSavedViewMutation = useUpdateSavedView(workspaceId);

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  const owners = useMemo(() => {
    return (facets?.owner ?? [])
      .map(bucket => bucket.value)
      .filter((value): value is string => value != null && value !== '')
      .sort();
  }, [facets]);

  const activeSavedView = useMemo(
    () => savedViews.find(savedView => savedView.id === viewId) ?? null,
    [savedViews, viewId]
  );

  const navigateEntities = useCallback(
    (params: {
      q?: string;
      viewId?: string;
      viewMode?: BrowserView;
      radarConfig?: string;
      timelineConfig?: string;
      sidebarTab?: 'filters' | 'views';
      filters?: FilterCondition[];
    }) => {
      const nextQuery = params.q ?? q;
      const nextFilters = params.filters ?? conditions;
      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug },
        search: {
          q: nextQuery === '' ? undefined : nextQuery,
          viewId: params.viewId ?? viewId ?? undefined,
          viewMode: params.viewMode ?? view,
          radarConfig:
            params.radarConfig ?? (radarConfig ? JSON.stringify(radarConfig) : undefined),
          timelineConfig:
            params.timelineConfig ?? (timelineConfig ? JSON.stringify(timelineConfig) : undefined),
          sidebarTab: params.sidebarTab ?? search.sidebarTab,
          filters: nextFilters.length > 0 ? JSON.stringify(nextFilters) : undefined
        }
      });
    },
    [
      navigate,
      workspaceSlug,
      q,
      viewId,
      view,
      radarConfig,
      timelineConfig,
      search.sidebarTab,
      conditions
    ]
  );

  const navigateToEntity = useCallback(
    (entityId: string) => {
      navigate({
        to: '/$workspaceSlug/entities/$entityId',
        params: { workspaceSlug, entityId }
      });
    },
    [navigate, workspaceSlug]
  );

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportEntitiesToCSV(workspaceId, {
        schemaId: typeFilter,
        owner: ownerFilter,
        lifecycle: statusFilter,
        q
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entities-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export entities. Please try again.');
    }
  }, [workspaceId, typeFilter, ownerFilter, statusFilter, q]);

  const handleDeleteEntity = (entity: EntityRecord) => {
    setDeleteTarget(entity);
  };

  const doDeleteEntity = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget._uid);
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const handleCloneEntity = async (entity: EntityRecord) => {
    try {
      const cloned = await cloneMutation.mutateAsync(entity._uid);
      navigateToEntity(cloned._uid);
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const typeName = typeFilter
    ? (schemaMap.get(typeFilter)?.schema.name ?? 'Entities')
    : 'All entities';

  const selectedSchema = typeFilter != null ? (schemaMap.get(typeFilter)?.schema ?? null) : null;
  const dateFields = useMemo(
    () =>
      selectedSchema?.fields.filter(
        (field): field is Extract<EntitySchema['fields'][number], { type: 'date' }> =>
          field.type === 'date'
      ) ?? [],
    [selectedSchema]
  );

  useEffect(() => {
    if (!sort.startsWith('date:')) return;
    const fieldId = sort.slice(5);
    if (view !== 'table' || !dateFields.some(field => field.id === fieldId)) {
      setSort('name');
    }
  }, [dateFields, sort, view]);

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

  const matchesCondition = useCallback((e: EntityRecord, c: FilterCondition) => {
    const value = e[c.fieldId];
    if (c.op === 'empty') return value == null || value === '';
    if (c.op === 'not_empty') return value != null && value !== '';

    if (value == null) return false;

    const expected = c.value;
    switch (c.op) {
      case 'equals':
        return String(value) === String(expected);
      case 'not_equals':
        return String(value) !== String(expected);
      case 'contains':
        return String(value).toLowerCase().includes(String(expected).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(expected).toLowerCase());
      case 'ends_with':
        return String(value).toLowerCase().endsWith(String(expected).toLowerCase());
      case 'on':
        return matchesDateFilter(value, 'on', expected as string);
      case 'before':
        return matchesDateFilter(value, 'before', expected as string);
      case 'after':
        return matchesDateFilter(value, 'after', expected as string);
      case 'gt':
        return Number(value) > Number(expected);
      case 'lt':
        return Number(value) < Number(expected);
      default:
        return true;
    }
  }, []);

  const filtered = useMemo<EntityRecord[]>(() => {
    const result = entities.filter(e => {
      for (const c of conditions) {
        if (!matchesCondition(e, c)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sort === 'name')
        return (a._name ?? a._slug ?? '').localeCompare(b._name ?? b._slug ?? '');
      if (sort === 'type') return a._schemaId.localeCompare(b._schemaId);
      if (sort === 'owner') return (a._owner ?? '').localeCompare(b._owner ?? '');
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
  }, [entities, conditions, sort, dateBrowserEnabled, matchesCondition]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e._uid)));
    }
  }, [filtered, selectedIds.size]);

  const handleSelectRow = useCallback((uid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const doBulkUpdate = async () => {
    const targets = entities.filter(e => selectedIds.has(e._uid));
    for (const entity of targets) {
      await updateEntityMutation.mutateAsync({
        entityId: entity._uid,
        data: {
          ...entity,
          ...(bulkLifecycleValue ? { _lifecycle: bulkLifecycleValue } : {}),
          ...(bulkOwnerValue ? { _owner: bulkOwnerValue } : {})
        }
      });
    }
    setSelectedIds(new Set());
    setBulkConfirming(false);
    setBulkLifecycleValue('');
    setBulkOwnerValue('');
  };

  const handleSaveView = async (name: string, description: string) => {
    try {
      await createSavedViewMutation.mutateAsync({
        name,
        description: description || null,
        viewMode: view,
        filters: {
          schemaId: typeFilter,
          status: statusFilter,
          owner: ownerFilter,
          q,
          sort,
          conditions
        },
        config: toSavedViewConfig(view, radarConfig, timelineConfig)
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const handleUpdateSavedView = useCallback(async () => {
    if (!permissions.canManageViews || activeSavedView == null) return;

    try {
      await updateSavedViewMutation.mutateAsync({
        id: activeSavedView.id,
        body: {
          viewMode: view,
          filters: {
            schemaId: typeFilter,
            status: statusFilter,
            owner: ownerFilter,
            q,
            sort,
            conditions
          },
          config: toSavedViewConfig(view, radarConfig, timelineConfig)
        }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  }, [
    permissions.canManageViews,
    activeSavedView,
    updateSavedViewMutation,
    view,
    typeFilter,
    statusFilter,
    ownerFilter,
    q,
    sort,
    conditions,
    radarConfig,
    timelineConfig
  ]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    if (permissions.canManageViews) {
      if (activeSavedView != null) {
        items.push({
          label: `Save View (${activeSavedView.name})`,
          icon: <TbCheck size={14} />,
          onClick: handleUpdateSavedView
        });
      }

      items.push({
        label: 'Save View As...',
        icon: <TbCopy size={14} />,
        onClick: () => setIsSavingView(true)
      });
    }

    items.push({
      label: 'Export CSV',
      icon: <TbDownload size={14} />,
      onClick: handleExport
    });

    if (permissions.canCreateEntities) {
      items.push({
        label: 'Import CSV',
        icon: <TbUpload size={14} />,
        onClick: () =>
          navigate({
            to: '/$workspaceSlug/entities/import',
            params: { workspaceSlug },
            search: typeFilter ? { type: typeFilter } : undefined
          })
      });
    }

    return items;
  }, [
    permissions,
    activeSavedView,
    handleUpdateSavedView,
    handleExport,
    navigate,
    workspaceSlug,
    typeFilter
  ]);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Entities</div>
          <div className={styles.titleRow}>
            <div className={styles.title}>{typeName}</div>
            <span className={styles.count}>{filtered.length}</span>
          </div>
          <div className={styles.sub}>
            Search, filter, and inspect everything in the IT landscape.
          </div>
        </div>
        <div className={styles.actions}>
          {permissions.canCreateEntities && (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddEntityDialog}>
              New entity
            </Button>
          )}
          <DropdownMenu trigger={<Button icon={<TbDots size={14} />} />} items={menuItems} />
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchInline}>
          <TbSearch size={12} />
          <input
            placeholder="Search by name, owner…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger
            element={
              <Button size="sm" variant={conditions.length > 0 ? 'primary' : 'secondary'}>
                <TbFilter size={12} style={{ marginRight: 4 }} />
                Filter
                {conditions.length > 0 && (
                  <span className={styles.filterCount}>{conditions.length}</span>
                )}
              </Button>
            }
          />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={styles.filterPopover}
          >
            <FilterBuilder
              conditions={conditions}
              onChange={c => navigateEntities({ filters: c })}
              onClose={() => filterPopoverRef.current?.close()}
              schemas={schemas}
              lifecycleStates={lifecycleStates}
              owners={owners.map(o => ({ id: o, sort_order: 0 }))}
              enums={enums}
              selectedSchemaId={typeFilter}
            />
          </Popover.Content>
        </Popover.Root>

        <div style={{ flex: 1 }} />

        <FilterDropdown label="Sort" value={sort} onChange={setSort} options={sortOptions} />

        <div className={styles.segmented}>
          <button
            type="button"
            className={view === 'table' ? styles.segmentedActive : ''}
            onClick={() => setView('table')}
            title="Table"
          >
            <TbList size={13} />
          </button>
          <button
            type="button"
            className={view === 'cards' ? styles.segmentedActive : ''}
            onClick={() => setView('cards')}
            title="Cards"
          >
            <TbLayoutGrid size={13} />
          </button>
          <button
            type="button"
            className={view === 'tree' ? styles.segmentedActive : ''}
            onClick={() => setView('tree')}
            title="Tree"
          >
            <TbBinaryTree2 size={13} />
          </button>
          <button
            type="button"
            className={view === 'radar' ? styles.segmentedActive : ''}
            onClick={() => setView('radar')}
            title="Radar"
          >
            <TbChartRadar size={13} />
          </button>
          <button
            type="button"
            className={view === 'timeline' ? styles.segmentedActive : ''}
            onClick={() => setView('timeline')}
            title="Timeline"
          >
            <TbCalendarWeek size={13} />
          </button>
        </div>
      </div>

      {view === 'timeline' ? (
        <TimelineView
          rows={filtered}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={navigateToEntity}
          config={timelineConfig}
          onConfigChange={setTimelineConfig}
        />
      ) : view === 'radar' ? (
        <RadarView
          onEntityClick={navigateToEntity}
          owner={ownerFilter}
          lifecycle={statusFilter}
          q={q}
          config={radarConfig}
          onConfigChange={setRadarConfig}
        />
      ) : view === 'tree' ? (
        treeNodes.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No entities found</div>
            <div>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <TreeView
            nodes={treeNodes}
            edges={treeEdges}
            schemaMap={schemaMap}
            onEntityClick={navigateToEntity}
            onDelete={handleDeleteEntity}
            onClone={handleCloneEntity}
            lifecycleStates={lifecycleStates}
          />
        )
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No entities found</div>
          <div>Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          {view === 'table' && selectedIds.size > 0 && (
            <BulkEditToolbar
              selectedIds={selectedIds}
              bulkConfirming={bulkConfirming}
              setBulkConfirming={setBulkConfirming}
              bulkLifecycleValue={bulkLifecycleValue}
              setBulkLifecycleValue={setBulkLifecycleValue}
              bulkOwnerValue={bulkOwnerValue}
              setBulkOwnerValue={setBulkOwnerValue}
              lifecycleStates={lifecycleStates}
              teams={teams}
              onClear={() => {
                setSelectedIds(new Set());
                setBulkLifecycleValue('');
                setBulkOwnerValue('');
              }}
              onConfirm={doBulkUpdate}
            />
          )}
          {view === 'table' && (
            <TableView
              rows={filtered}
              schemaMap={schemaMap}
              activeDateField={dateBrowserEnabled ? activeDateField : null}
              onEntityClick={navigateToEntity}
              onDelete={handleDeleteEntity}
              onClone={handleCloneEntity}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              lifecycleStates={lifecycleStates}
            />
          )}
          {view === 'cards' && (
            <CardsView
              rows={filtered}
              schemaMap={schemaMap}
              onEntityClick={navigateToEntity}
              onDelete={handleDeleteEntity}
              onClone={handleCloneEntity}
              lifecycleStates={lifecycleStates}
            />
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete entity?"
        message={
          deleteTarget ? (
            <>
              The entity <b>{deleteTarget._name || deleteTarget._slug}</b> will be permanently
              deleted.
            </>
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel="Delete entity"
        onConfirm={doDeleteEntity}
        onCancel={() => setDeleteTarget(null)}
      />

      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
      />
    </div>
  );
};

const FilterDropdown = ({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <label className={styles.filter}>
    <span className={styles.filterLabel}>{label}</span>
    <select className={styles.filterSelect} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <TbChevronDown size={10} />
  </label>
);

type ViewProps = {
  rows: EntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  activeDateField?: Extract<EntitySchema['fields'][number], { type: 'date' }> | null;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
};

const entityName = (e: EntityRecord) => e._name || e._slug;

const entityMenuItems = (
  entity: EntityRecord,
  onClone: (entity: EntityRecord) => void,
  onDelete: (entity: EntityRecord) => void
): MenuItem[] => {
  const items: MenuItem[] = [];
  if (entity.canCreateChild) {
    items.push({ label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(entity) });
  }
  if (entity.canDelete) {
    items.push({
      label: 'Delete',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => onDelete(entity)
    });
  }
  return items;
};

const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  selectedIds,
  onSelectAll,
  onSelectRow
}: ViewProps & {
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectRow: (uid: string) => void;
}) => {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={onSelectAll}
              />
            </th>
            <th style={{ minWidth: 200 }}>Name</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Status</th>
            {activeDateField && <th>{activeDateField.name}</th>}
            <th style={{ width: 80 }}>NS</th>
            <th style={{ width: 80 }}></th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map(e => {
            const s = schemaMap.get(e._schemaId);
            return (
              <tr
                key={e._uid}
                className={selectedIds.has(e._uid) ? styles.tableRowSelected : undefined}
                onClick={() => onEntityClick(e._uid)}
              >
                <td onClick={ev => ev.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedIds.has(e._uid)}
                    onChange={() => onSelectRow(e._uid)}
                  />
                </td>
                <td>
                  <div className={styles.tableName}>
                    {s && (
                      <TypeBadge
                        color={resolveSchemaColor(s.schema, s.index)}
                        name={s.schema.name}
                        icon={s.schema.icon}
                        size={18}
                      />
                    )}
                    <div>
                      <div className={styles.tableNameMain}>{entityName(e)}</div>
                      {e._description && (
                        <div className={styles.tableNameSub}>{e._description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{s && <Chip tone="ghost">{s.schema.name}</Chip>}</td>
                <td>
                  <span className="dim">{e._owner ?? '—'}</span>
                </td>
                <td>
                  {e._lifecycle && (
                    <StatusChip value={e._lifecycle} lifecycleStates={lifecycleStates} />
                  )}
                </td>
                {activeDateField && (
                  <td>
                    <span className="dim">{formatDateValue(e[activeDateField.id])}</span>
                  </td>
                )}
                <td>
                  <span className="dim">{e._namespace}</span>
                </td>
                <td>
                  <CompletenessCell value={e._completeness} />
                </td>
                <td onClick={ev => ev.stopPropagation()}>
                  {entityMenuItems(e, onClone, onDelete).length > 0 && (
                    <DropdownMenu
                      trigger={
                        <button type="button" className={styles.dotsBtn}>
                          <TbDots size={14} />
                        </button>
                      }
                      items={entityMenuItems(e, onClone, onDelete)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const CardsView = ({
  rows,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates
}: ViewProps) => (
  <div className={styles.cardGrid}>
    {rows.map(e => {
      const s = schemaMap.get(e._schemaId);
      const color = s ? resolveSchemaColor(s.schema, s.index) : 'var(--accent-fg)';
      return (
        <div key={e._uid} className={styles.card} onClick={() => onEntityClick(e._uid)}>
          <span className={styles.cardBar} style={{ background: color }} />
          <div className={styles.cardHead}>
            {s && <TypeBadge color={color} name={s.schema.name} size={22} />}
            <div className={styles.cardHeadRight}>
              {e._lifecycle && (
                <StatusChip value={e._lifecycle} lifecycleStates={lifecycleStates} />
              )}
              {entityMenuItems(e, onClone, onDelete).length > 0 && (
                <span onClick={ev => ev.stopPropagation()}>
                  <DropdownMenu
                    trigger={
                      <button type="button" className={styles.dotsBtn}>
                        <TbDots size={14} />
                      </button>
                    }
                    items={entityMenuItems(e, onClone, onDelete)}
                  />
                </span>
              )}
            </div>
          </div>
          <div className={styles.cardName}>{entityName(e)}</div>
          {e._description && <div className={styles.cardDesc}>{e._description}</div>}
          <div className={styles.cardMeta}>
            <Chip tone="ghost" icon={<TbUsers size={10} />}>
              {e._owner ?? '—'}
            </Chip>
            {s && <Chip tone="ghost">{s.schema.name}</Chip>}
          </div>
        </div>
      );
    })}
  </div>
);

type TreeViewProps = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
};

type TreeItem = TreeNode & { children: TreeItem[] };

const TreeView = ({
  nodes,
  edges,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates
}: TreeViewProps) => {
  const roots = useMemo(() => {
    const nodeMap = new Map<string, TreeItem>();
    for (const n of nodes) nodeMap.set(n._uid, { ...n, children: [] });

    const childIds = new Set<string>();
    for (const { childId, parentId } of edges) {
      const parent = nodeMap.get(parentId);
      const child = nodeMap.get(childId);
      if (parent && child) {
        parent.children.push(child);
        childIds.add(childId);
      }
    }

    // Sort children alphabetically
    for (const item of nodeMap.values()) {
      item.children.sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
    }

    // Roots are nodes that are not children of any other node
    return [...nodeMap.values()]
      .filter(n => !childIds.has(n._uid))
      .sort((a, b) => (a._name || a._slug).localeCompare(b._name || b._slug));
  }, [nodes, edges]);

  if (nodes.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ minWidth: 240 }}>Name</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Status</th>
            <th style={{ width: 110 }}>Namespace</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {roots.map(item => (
            <TreeNodeRow
              key={item._uid}
              item={item}
              depth={0}
              schemaMap={schemaMap}
              onEntityClick={onEntityClick}
              onDelete={onDelete}
              onClone={onClone}
              lifecycleStates={lifecycleStates}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TreeNodeRow = ({
  item,
  depth,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates
}: {
  item: TreeItem;
  depth: number;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const s = schemaMap.get(item._schemaId);
  const isAncestor = !item._isMatch;

  return (
    <>
      <tr
        className={isAncestor ? styles.treeRowAncestor : undefined}
        onClick={() => onEntityClick(item._uid)}
      >
        <td>
          <div className={styles.tableName} style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button
                type="button"
                className={styles.treeToggle}
                onClick={e => {
                  e.stopPropagation();
                  setExpanded(v => !v);
                }}
              >
                {expanded ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
              </button>
            ) : (
              <span className={styles.treeToggleSpacer} />
            )}
            {s && (
              <TypeBadge
                color={resolveSchemaColor(s.schema, s.index)}
                name={s.schema.name}
                icon={s.schema.icon}
                size={18}
              />
            )}
            <div>
              <div className={styles.tableNameMain}>{item._name || item._slug}</div>
              {item._description && <div className={styles.tableNameSub}>{item._description}</div>}
            </div>
          </div>
        </td>
        <td>{s && <Chip tone="ghost">{s.schema.name}</Chip>}</td>
        <td>
          <span className="dim">{item._owner ?? '—'}</span>
        </td>
        <td>
          {item._lifecycle && (
            <StatusChip value={item._lifecycle} lifecycleStates={lifecycleStates} />
          )}
        </td>
        <td>
          <span className="dim">{item._namespace}</span>
        </td>
        <td onClick={ev => ev.stopPropagation()}>
          {entityMenuItems(item as unknown as EntityRecord, onClone, onDelete).length > 0 && (
            <DropdownMenu
              trigger={
                <button type="button" className={styles.dotsBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={entityMenuItems(item as unknown as EntityRecord, onClone, onDelete)}
            />
          )}
        </td>
      </tr>
      {expanded &&
        item.children.map(child => (
          <TreeNodeRow
            key={child._uid}
            item={child}
            depth={depth + 1}
            schemaMap={schemaMap}
            onEntityClick={onEntityClick}
            onDelete={onDelete}
            onClone={onClone}
            lifecycleStates={lifecycleStates}
          />
        ))}
    </>
  );
};

const CompletenessCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="dim">—</span>;
  const barColor = value <= 75 ? '#f59e0b' : '#22c55e';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'var(--cmp-border)',
          overflow: 'hidden'
        }}
      >
        <span
          style={{ display: 'block', width: `${value}%`, height: '100%', background: barColor }}
        />
      </span>
      <span className="dim" style={{ fontSize: 11 }}>
        {value}%
      </span>
    </span>
  );
};
