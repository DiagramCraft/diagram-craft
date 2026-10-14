import { useEffect, useState, type ReactNode } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbCheck, TbX } from 'react-icons/tb';
import { LoadingState } from '../../components/LoadingState';
import './TabContentsEditor'; // registers the tab contents editor
import { DashboardGridCanvas } from './DashboardGridCanvas';
import { WidgetPickerDialog } from './WidgetPickerDialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';
import type { WidgetSurface } from '../markdown/mdx-components/types';
import styles from './DashboardGrid.module.css';

type Props = {
  widgets: DashboardWidget[];
  canEdit: boolean;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (widgets: DashboardWidget[]) => void;
  isLoading: boolean;
  workspaceSlug: string;
  surface?: WidgetSurface;
  /** Extra buttons rendered in the edit-actions row, before Cancel/Save (e.g. "Edit sidebar"). */
  extraActions?: ReactNode;
};

export const DashboardGrid = ({
  widgets,
  canEdit,
  isEditing,
  onEditingChange,
  onSave,
  isLoading,
  workspaceSlug,
  surface = 'workspace',
  extraActions
}: Props) => {
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(widgets);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) setLocalWidgets(widgets);
  }, [widgets, isEditing]);

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
            {extraActions}
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
        <DashboardGridCanvas
          widgets={localWidgets}
          onWidgetsChange={updater => setLocalWidgets(updater)}
          isEditing={canEditGrid}
          onEditWidget={setEditingWidgetId}
          surface={surface}
        />
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
          surface={surface}
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
