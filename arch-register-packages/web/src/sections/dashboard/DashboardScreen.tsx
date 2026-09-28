import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useWorkspaceDashboards,
  useUpdateWorkspaceDashboard,
  usePersonalDashboards,
  useUpdatePersonalDashboard
} from '../../hooks/useDashboard';
import { DashboardHeader } from './DashboardHeader';
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
  const [draft, setDraft] = useState({ name: '', description: '' });

  if (!workspace) return null;

  const canEditActiveDashboard = canManageDashboard || isPersonalActive;

  const startEditing = () => {
    setDraft({
      name: sharedDashboard?.name ?? '',
      description: sharedDashboard?.description ?? ''
    });
    setIsEditing(true);
  };

  const handleSave = (widgets: DashboardWidget[]) => {
    if (!activeDashboardId) return;
    if (isPersonalActive) {
      updatePersonalDashboard.mutate({ id: activeDashboardId, body: { widgets } });
    } else {
      updateDashboard.mutate({
        id: activeDashboardId,
        body: {
          widgets,
          name: draft.name.trim() || sharedDashboard?.name,
          description: draft.description.trim()
        }
      });
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <DashboardHeader
          eyebrow={sharedDashboard ? workspace.name : 'Home'}
          title={sharedDashboard?.name ?? workspace.name}
          description={
            sharedDashboard
              ? sharedDashboard.description || workspace.description || undefined
              : workspace.description
          }
          canEdit={canEditActiveDashboard}
          detailsEditable={!isPersonalActive}
          isEditing={isEditing}
          draft={draft}
          onDraftChange={setDraft}
          onStartEditing={startEditing}
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
