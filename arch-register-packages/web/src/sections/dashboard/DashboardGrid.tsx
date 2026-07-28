import { useEffect, useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import ReactGridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbCheck, TbX } from 'react-icons/tb';
import { LoadingState } from '../../components/LoadingState';
import { DashboardWidgetRenderer } from './widgets/DashboardWidgetRenderer';
import { WidgetPickerDialog } from './WidgetPickerDialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';
import type { WidgetSurface } from './dashboardWidgetDefaults';
import { parseKnownDashboardWidget } from './dashboardWidgetConfig';
import styles from './DashboardGrid.module.css';

const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 80;
const FALLBACK_WIDTH = 1200;

type Props = {
  widgets: DashboardWidget[];
  canEdit: boolean;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (widgets: DashboardWidget[]) => void;
  isLoading: boolean;
  workspaceSlug: string;
  surface?: WidgetSurface;
};

export const DashboardGrid = ({
  widgets,
  canEdit,
  isEditing,
  onEditingChange,
  onSave,
  isLoading,
  workspaceSlug,
  surface = 'workspace'
}: Props) => {
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(widgets);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) setLocalWidgets(widgets);
  }, [widgets, isEditing]);

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

  const layout: Layout = useMemo(
    () => localWidgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h })),
    [localWidgets]
  );

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
    onSave(localWidgets);
    onEditingChange(false);
  };

  const handleCancel = () => {
    setLocalWidgets(widgets);
    onEditingChange(false);
  };

  const canEditGrid = isEditing && canEdit;
  const editingWidget = localWidgets.find(w => w.id === editingWidgetId) ?? null;

  return (
    <>
      {isEditing && canEdit && (
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
                  onEdit={
                    canEditGrid && parseKnownDashboardWidget(widget)
                      ? () => setEditingWidgetId(widget.id)
                      : undefined
                  }
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

      {canEdit && (
        <WidgetPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          workspaceSlug={workspaceSlug}
          surface={surface}
          widgets={localWidgets}
          onAdd={widget => setLocalWidgets(current => [...current, widget])}
        />
      )}

      {canEdit && (
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
    </>
  );
};
