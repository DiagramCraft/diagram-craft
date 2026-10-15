import { useEffect, useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import ReactGridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { DashboardWidgetRenderer } from '../../widgets/shared/dashboard/DashboardWidgetRenderer';
import { MdxContext, useMdxContext } from '../markdown/MdxContext';
import type { WidgetSurface } from '../../widgets/shared/types';
import { parseKnownDashboardWidget } from './dashboardWidgets';
import styles from './DashboardGrid.module.css';

const GRID_COLS = 12;
// Fine-grained rows: with the 12px margin, 4 rows span exactly what 1 row of the former 80px grid did.
const GRID_ROW_HEIGHT = 11;
const FALLBACK_WIDTH = 1200;

type Props = {
  widgets: DashboardWidget[];
  onWidgetsChange: (updater: (current: DashboardWidget[]) => DashboardWidget[]) => void;
  isEditing: boolean;
  onEditWidget: (widgetId: string) => void;
  surface: WidgetSurface;
};

/** Controlled drag/resize grid shared by the top-level dashboard and the tab contents editor. */
export const DashboardGridCanvas = ({
  widgets,
  onWidgetsChange,
  isEditing,
  onEditWidget,
  surface
}: Props) => {
  const ambientMdxContext = useMdxContext();
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
    () => widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h })),
    [widgets]
  );

  const handleLayoutChange = (nextLayout: Layout) => {
    onWidgetsChange(current =>
      current.map(widget => {
        const item = nextLayout.find(l => l.i === widget.id);
        if (!item) return widget;
        return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
      })
    );
  };

  return (
    <div className={styles.gridContainer} ref={setGridContainerEl}>
      <MdxContext.Provider
        value={{ ...ambientMdxContext, renderMode: 'dashboard', dashboardSurface: surface }}
      >
        <ReactGridLayout
          width={width}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          layout={layout}
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange}
          compactType={null}
          preventCollision={true}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableCancel=".widgetControls"
        >
          {widgets.map(widget => (
            <div key={widget.id} className={styles.gridItem}>
              <DashboardWidgetRenderer
                widget={widget}
                isEditing={isEditing}
                onEdit={
                  isEditing && parseKnownDashboardWidget(widget)
                    ? () => onEditWidget(widget.id)
                    : undefined
                }
                onRemove={
                  isEditing
                    ? () => onWidgetsChange(current => current.filter(w => w.id !== widget.id))
                    : undefined
                }
              />
            </div>
          ))}
        </ReactGridLayout>
      </MdxContext.Provider>
    </div>
  );
};
