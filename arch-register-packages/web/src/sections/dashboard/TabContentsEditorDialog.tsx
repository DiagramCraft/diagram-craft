import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
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
import styles from './TabContentsEditorDialog.module.css';

/** Large dialog that edits one tab's widgets with the same grid editor as the top-level dashboard. */
export const TabContentsEditorDialog = ({
  title,
  widgets,
  workspaceSlug,
  surface,
  onClose,
  onSave
}: TabContentsEditorProps) => {
  const [local, setLocal] = useState<DashboardWidget[]>(widgets);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const editingWidget = local.find(w => w.id === editingWidgetId) ?? null;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={title}
        width="90vw"
        className={styles.dialog}
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: onClose },
          { label: 'Save', type: 'default', onClick: () => onSave(local) }
        ]}
      >
        <div className={styles.toolbar}>
          <Button
            variant="secondary"
            icon={<TbPlus size={12} />}
            onClick={() => setPickerOpen(true)}
          >
            Add widget
          </Button>
        </div>
        <DashboardGridCanvas
          widgets={local}
          onWidgetsChange={updater => setLocal(updater)}
          isEditing
          onEditWidget={setEditingWidgetId}
          surface={surface}
        />
      </Dialog>

      <WidgetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workspaceSlug={workspaceSlug}
        surface={surface}
        widgets={local}
        exclude={[TABS_TYPE]}
        onAdd={widget => setLocal(current => [...current, widget])}
      />

      <WidgetConfigDialog
        widget={editingWidget}
        open={editingWidget !== null}
        workspaceSlug={workspaceSlug}
        surface={surface}
        onClose={() => setEditingWidgetId(null)}
        onSave={updated => {
          setLocal(current => current.map(w => (w.id === updated.id ? updated : w)));
          setEditingWidgetId(null);
        }}
      />
    </>
  );
};

registerNestedWidgetResolvers({ TabContentsEditor: TabContentsEditorDialog });
