import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSidebarConfig } from '@arch-register/api-types/dashboardContract';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { entitiesQuery } from '../../queries/entities';
import { useSchemas } from '../../hooks/useSchemas';
import styles from '../../shell/SidePanel.module.css';

type Props = {
  workspaceSlug: string;
  sidebar: DashboardSidebarConfig;
  title: string;
};

/**
 * A dashboard's optional selection sidebar. Supports one kind today — `entity-picker`, a plain
 * list of a schema's entities, single-select — mirroring the shape of the API & Integration
 * Catalog Impact section's former bespoke `ImpactSidebarContent`. The current selection is URL
 * state, keyed by `sidebar.variableName`, exactly like every other per-app sidebar in this app;
 * `AppDashboardScreen` reads the same param to populate `DashboardSidebarContext`, which widget
 * config strings reference via `resolveSidebarVariableReferences`.
 */
export const DashboardSidebar = ({ workspaceSlug, sidebar, title }: Props) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const selected = search[sidebar.variableName];

  const schemas = useSchemas(workspaceSlug);
  const schemaId = schemas.data?.find(schema => schema.name === sidebar.schemaName)?.id;

  const entities = useQuery(
    entitiesQuery(workspaceSlug, { schemaId, limit: 500 }, schemaId != null)
  );
  const items = entities.data?.items ?? [];
  const sorted = useMemo(() => [...items].sort((a, b) => a._name.localeCompare(b._name)), [items]);

  const select = (publicId: string) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [sidebar.variableName]: publicId
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
              label={entity._name}
              testId={`dashboard-sidebar-item-${entity._uid}`}
              active={selected === entity._publicId}
              onClick={() => select(entity._publicId)}
            />
          ))}
      </div>
    </>
  );
};
