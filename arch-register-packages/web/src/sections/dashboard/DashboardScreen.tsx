import { useEffect, useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import ReactGridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbEdit, TbCheck, TbX } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useWorkspaceDashboard, useUpdateWorkspaceDashboard } from '../../hooks/useDashboard';
import { LoadingState } from '../../components/LoadingState';
import { DashboardWidgetRenderer } from './widgets/DashboardWidgetRenderer';
import { WidgetPickerDialog } from './WidgetPickerDialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';
import { DEFAULT_SEEDED_WIDGETS } from './dashboardWidgetDefaults';
import styles from './DashboardScreen.module.css';

const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 80;
const FALLBACK_WIDTH = 1200;

export const DashboardScreen = () => {
  const { workspace, workspaceSlug, permissions, openAddProjectDialog, openAddEntityDialog } =
    useWorkspaceContext();
  const { canManageDashboard, canCreateProjects, canCreateEntities } = permissions;

  const { data, isLoading } = useWorkspaceDashboard(workspaceSlug);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);

  const persistedWidgets = useMemo(
    () => (data && data.widgets.length > 0 ? data.widgets : DEFAULT_SEEDED_WIDGETS),
    [data]
  );

  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(persistedWidgets);
  const [isEditing, setIsEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) setLocalWidgets(persistedWidgets);
  }, [persistedWidgets, isEditing]);

  const [gridContainerEl, setGridContainerEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    if (!gridContainerEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(gridContainerEl);
    setWidth(gridContainerEl.clientWidth || FALLBACK_WIDTH);

    return () => observer.disconnect();
  }, [gridContainerEl]);

  if (!workspace) return null;

  const layout: Layout = localWidgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));

  const handleLayoutChange = (nextLayout: Layout) => {
    setLocalWidgets(current =>
      current.map(widget => {
        const item = nextLayout.find(l => l.i === widget.id);
        if (!item) return widget;
        return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
      })
    );
  };

  const handleSave = () => {
    updateDashboard.mutate({ widgets: localWidgets });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalWidgets(persistedWidgets);
    setIsEditing(false);
  };

  const canEditGrid = isEditing && canManageDashboard;
  const editingWidget = localWidgets.find(w => w.id === editingWidgetId) ?? null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          eyebrow="Home"
          title={workspace.name}
          description={workspace.description}
          buttons={
            <>
              {canCreateProjects && (
                <Button icon={<TbPlus size={12} />} onClick={openAddProjectDialog}>
                  New project
                </Button>
              )}
              {canCreateEntities && (
                <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddEntityDialog}>
                  New entity
                </Button>
              )}
              {canManageDashboard && !isEditing && (
                <Button icon={<TbEdit size={12} />} onClick={() => setIsEditing(true)}>
                  Edit dashboard
                </Button>
              )}
            </>
          }
        />
      </div>

      {isEditing && canManageDashboard && (
        <div className={styles.editActions}>
          <div className={styles.editActionsLeft}>
            <Button
              variant="secondary"
              icon={<TbPlus size={12} />}
              onClick={() => setPickerOpen(true)}
            >
              Add widget
            </Button>
          </div>
          <div className={styles.editActionsRight}>
            <Button variant="secondary" icon={<TbX size={12} />} onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="secondary" icon={<TbCheck size={12} />} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState text="Loading dashboard…" />
      ) : (
        <div className={styles.gridContainer} ref={setGridContainerEl}>
          <ReactGridLayout
            width={width}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            layout={layout}
            isDraggable={canEditGrid}
            isResizable={canEditGrid}
            onLayoutChange={handleLayoutChange}
            compactType={null}
            preventCollision={true}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            draggableCancel=".widgetControls"
          >
            {localWidgets.map(widget => (
              <div key={widget.id} className={styles.gridItem}>
                <DashboardWidgetRenderer
                  widget={widget}
                  onEdit={canEditGrid ? () => setEditingWidgetId(widget.id) : undefined}
                  onRemove={
                    canEditGrid
                      ? () => setLocalWidgets(current => current.filter(w => w.id !== widget.id))
                      : undefined
                  }
                />
              </div>
            ))}
          </ReactGridLayout>
        </div>
      )}

      {canManageDashboard && (
        <WidgetPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          workspaceSlug={workspaceSlug}
          widgets={localWidgets}
          onAdd={widget => setLocalWidgets(current => [...current, widget])}
        />
      )}

      {canManageDashboard && (
        <WidgetConfigDialog
          widget={editingWidget}
          open={editingWidget !== null}
          workspaceSlug={workspaceSlug}
          onClose={() => setEditingWidgetId(null)}
          onSave={updated => {
            setLocalWidgets(current => current.map(w => (w.id === updated.id ? updated : w)));
            setEditingWidgetId(null);
          }}
        />
      )}
    </div>
  );
};
