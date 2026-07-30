import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPencil } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useWorkspaceDashboards,
  useUpdateWorkspaceDashboard,
  usePersonalDashboards,
  useUpdatePersonalDashboard
} from '../../hooks/useDashboard';
import { DashboardGrid } from './DashboardGrid';
import { MdxContext } from '../markdown/MdxContext';
import { DEFAULT_SEEDED_WIDGETS } from './dashboardWidgetDefaults';
import styles from './DashboardScreen.module.css';

export const DashboardScreen = () => {
  const { workspace, workspaceSlug, permissions } = useWorkspaceContext();
  const { canManageDashboard } = permissions;

  const search = useSearch({ strict: false }) as { dashboard?: string };
  const { data: dashboards, isLoading } = useWorkspaceDashboards(workspaceSlug);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);

  const { data: personalDashboards, isLoading: isPersonalLoading } =
    usePersonalDashboards(workspaceSlug);
  const updatePersonalDashboard = useUpdatePersonalDashboard(workspaceSlug);

  const activeDashboardId = search.dashboard ?? dashboards?.[0]?.id;
  const sharedDashboard = dashboards?.find(d => d.id === activeDashboardId) ?? null;
  const personalDashboard = sharedDashboard
    ? null
    : (personalDashboards?.find(d => d.id === activeDashboardId) ?? null);
  const activeDashboard = sharedDashboard ?? personalDashboard;
  const isPersonalActive = personalDashboard !== null;

  const persistedWidgets = useMemo(
    () =>
      activeDashboard && activeDashboard.widgets.length > 0
        ? activeDashboard.widgets
        : DEFAULT_SEEDED_WIDGETS,
    [activeDashboard]
  );

  const [isEditing, setIsEditing] = useState(false);

  if (!workspace) return null;

  const canEditActiveDashboard = canManageDashboard || isPersonalActive;

  const handleSave = (widgets: DashboardWidget[]) => {
    if (!activeDashboardId) return;
    if (isPersonalActive) {
      updatePersonalDashboard.mutate({ id: activeDashboardId, body: { widgets } });
    } else {
      updateDashboard.mutate({ id: activeDashboardId, body: { widgets } });
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          eyebrow="Home"
          title={workspace.name}
          description={workspace.description}
          buttons={
            canEditActiveDashboard &&
            !isEditing && (
              <Button icon={<TbPencil size={12} />} onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )
          }
        />
      </div>

      <MdxContext.Provider value={{ workspaceSlug }}>
        <DashboardGrid
          widgets={persistedWidgets}
          canEdit={canEditActiveDashboard}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          onSave={handleSave}
          isLoading={isLoading || isPersonalLoading}
          workspaceSlug={workspaceSlug}
          surface="workspace"
        />
      </MdxContext.Provider>
    </div>
  );
};
