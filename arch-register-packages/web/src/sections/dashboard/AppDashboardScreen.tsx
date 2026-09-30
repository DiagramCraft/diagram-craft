import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { TbLayoutSidebar } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  DashboardSidebarConfig,
  DashboardWidget
} from '@arch-register/api-types/dashboardContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useAppDashboard, useUpdateWorkspaceDashboard } from '../../hooks/useDashboard';
import { DashboardHeader } from './DashboardHeader';
import { DashboardGrid } from './DashboardGrid';
import { DashboardSidebarConfigDialog } from './DashboardSidebarConfigDialog';
import { DashboardSidebarProvider } from './DashboardSidebarContext';
import { computeSidebarVariables } from './dashboardSidebarVariables';
import { MdxContext } from '../markdown/MdxContext';
import styles from './DashboardScreen.module.css';

export const AppDashboardScreen = (props: { appKey: string }) => {
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const { canManageDashboard } = permissions;

  const { data: dashboard, isLoading } = useAppDashboard(workspaceSlug, props.appKey);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);
  const widgets = useMemo(() => dashboard?.widgets ?? [], [dashboard]);
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const sidebar = dashboard?.sidebar;
  const sidebarVariables = useMemo(
    () => computeSidebarVariables(sidebar, search),
    [sidebar, search]
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });
  const [sidebarDraft, setSidebarDraft] = useState<DashboardSidebarConfig | null>(sidebar ?? null);
  const [sidebarDialogOpen, setSidebarDialogOpen] = useState(false);

  const startEditing = () => {
    setDraft({ name: dashboard?.name ?? '', description: dashboard?.description ?? '' });
    setSidebarDraft(sidebar ?? null);
    setIsEditing(true);
  };

  const handleEditingChange = (editing: boolean) => {
    if (!editing) setSidebarDraft(sidebar ?? null);
    setIsEditing(editing);
  };

  const handleSave = (next: DashboardWidget[]) => {
    if (!dashboard) return;
    updateDashboard.mutate({
      id: dashboard.id,
      body: {
        widgets: next,
        name: draft.name.trim() || dashboard.name,
        description: draft.description.trim(),
        sidebar: sidebarDraft
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
        <DashboardSidebarProvider value={sidebarVariables}>
          <DashboardGrid
            widgets={widgets}
            canEdit={canManageDashboard}
            isEditing={isEditing}
            onEditingChange={handleEditingChange}
            onSave={handleSave}
            isLoading={isLoading}
            workspaceSlug={workspaceSlug}
            surface="workspace"
            extraActions={
              <Button
                variant="secondary"
                icon={<TbLayoutSidebar size={12} />}
                onClick={() => setSidebarDialogOpen(true)}
              >
                Edit sidebar
              </Button>
            }
          />
        </DashboardSidebarProvider>
      </MdxContext.Provider>

      <DashboardSidebarConfigDialog
        open={sidebarDialogOpen}
        workspaceSlug={workspaceSlug}
        sidebar={sidebarDraft}
        onClose={() => setSidebarDialogOpen(false)}
        onSave={setSidebarDraft}
      />
    </div>
  );
};
