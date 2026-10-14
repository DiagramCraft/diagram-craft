import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus } from 'react-icons/tb';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { DashboardGridCanvas } from './DashboardGridCanvas';
import { WidgetPickerDialog } from './WidgetPickerDialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';
import {
  registerNestedWidgetResolvers,
  type TabContentsEditorProps
} from './widgets/nestedWidgets';
import { TABS_TYPE } from './widgets/tabsLogic';
import styles from './TabContentsEditor.module.css';

/** Edits one tab's widgets with the same grid editor as the top-level dashboard. */
export const TabContentsEditor = ({
  widgets,
  onChange,
  workspaceSlug,
  surface
}: TabContentsEditorProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const editingWidget = widgets.find(w => w.id === editingWidgetId) ?? null;

  return (
    <>
      <div className={styles.toolbar}>
        <Button variant="secondary" icon={<TbPlus size={12} />} onClick={() => setPickerOpen(true)}>
          Add widget
        </Button>
      </div>
      <DashboardGridCanvas
        widgets={widgets}
        onWidgetsChange={updater => onChange(updater(widgets))}
        isEditing
        onEditWidget={setEditingWidgetId}
        surface={surface}
      />

      <WidgetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workspaceSlug={workspaceSlug}
        surface={surface}
        widgets={widgets}
        exclude={[TABS_TYPE]}
        onAdd={(widget: DashboardWidget) => onChange([...widgets, widget])}
      />

      <WidgetConfigDialog
        widget={editingWidget}
        open={editingWidget !== null}
        surface={surface}
        onClose={() => setEditingWidgetId(null)}
        onSave={updated => {
          onChange(widgets.map(w => (w.id === updated.id ? updated : w)));
          setEditingWidgetId(null);
        }}
      />
    </>
  );
};

registerNestedWidgetResolvers({ TabContentsEditor });
