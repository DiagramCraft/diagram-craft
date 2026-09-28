import { useMemo, useState } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useAppDashboard, useUpdateWorkspaceDashboard } from '../../hooks/useDashboard';
import { DashboardHeader } from './DashboardHeader';
import { DashboardGrid } from './DashboardGrid';
import { MdxContext } from '../markdown/MdxContext';
import styles from './DashboardScreen.module.css';

export const AppDashboardScreen = (props: { appKey: string }) => {
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const { canManageDashboard } = permissions;

  const { data: dashboard, isLoading } = useAppDashboard(workspaceSlug, props.appKey);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);
  const widgets = useMemo(() => dashboard?.widgets ?? [], [dashboard]);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });

  const startEditing = () => {
    setDraft({ name: dashboard?.name ?? '', description: dashboard?.description ?? '' });
    setIsEditing(true);
  };

  const handleSave = (next: DashboardWidget[]) => {
    if (!dashboard) return;
    updateDashboard.mutate({
      id: dashboard.id,
      body: {
        widgets: next,
        name: draft.name.trim() || dashboard.name,
        description: draft.description.trim()
      }
    });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <DashboardHeader
          title={dashboard?.name ?? ''}
          description={dashboard?.description || undefined}
          canEdit={canManageDashboard}
          isEditing={isEditing}
          draft={draft}
          onDraftChange={setDraft}
          onStartEditing={startEditing}
        />
      </div>

      <MdxContext.Provider value={{ workspaceSlug }}>
        <DashboardGrid
          widgets={widgets}
          canEdit={canManageDashboard}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          onSave={handleSave}
          isLoading={isLoading}
          workspaceSlug={workspaceSlug}
          surface="workspace"
        />
      </MdxContext.Provider>
    </div>
  );
};
