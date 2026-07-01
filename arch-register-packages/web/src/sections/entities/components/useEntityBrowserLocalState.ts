import { useCallback, useMemo, useState } from 'react';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { BrowserViewConfigMap } from './entityBrowserState';
import { getFilterValue } from './entityBrowserState';

export type EntityBrowserLocalStateInitial = Partial<{
  q: string;
  conditions: FilterCondition[];
  projectScope: 'project' | 'all';
  sort: string;
  view: BrowserView;
  viewConfigs: BrowserViewConfigMap;
}>;

type UseEntityBrowserLocalStateProps = {
  projectId?: string;
  initial?: EntityBrowserLocalStateInitial;
};

export const useEntityBrowserLocalState = ({
  projectId,
  initial
}: UseEntityBrowserLocalStateProps) => {
  const [q, setQ] = useState(initial?.q ?? '');
  const [conditions, setConditions] = useState<FilterCondition[]>(initial?.conditions ?? []);
  const [projectScope, setProjectScope] = useState<'project' | 'all'>(
    initial?.projectScope ?? (projectId ? 'project' : 'all')
  );
  const [sort, setSort] = useState(initial?.sort ?? 'name');
  const [view, setView] = useState<BrowserView>(initial?.view ?? 'table');
  const [viewConfigs, setViewConfigs] = useState<BrowserViewConfigMap>(
    initial?.viewConfigs ?? {}
  );

  const typeFilter = useMemo(() => getFilterValue(conditions, '_schemaId'), [conditions]);
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);
  const activeViewConfig = useMemo(() => viewConfigs[view] ?? null, [view, viewConfigs]);

  const setActiveViewConfig = useCallback(
    (config: unknown) => {
      setViewConfigs(prev => {
        const next = { ...prev };
        if (config == null) delete next[view];
        else next[view] = config;
        return next;
      });
    },
    [view]
  );

  return {
    activeViewConfig,
    conditions,
    ownerFilter,
    projectScope,
    q,
    setConditions,
    setActiveViewConfig,
    setProjectScope,
    setQ,
    setSort,
    setView,
    setViewConfigs,
    sort,
    statusFilter,
    typeFilter,
    view,
    viewConfigs
  };
};
