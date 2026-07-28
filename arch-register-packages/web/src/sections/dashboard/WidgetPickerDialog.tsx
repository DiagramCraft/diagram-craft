import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type {
  DashboardWidget,
  DashboardWidgetType
} from '@arch-register/api-types/dashboardContract';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useMdxContext } from '../markdown/MdxContext';
import {
  WIDGET_TYPE_OPTIONS,
  createDefaultWidget,
  type WidgetSurface
} from './dashboardWidgetDefaults';
import styles from './WidgetPickerDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  surface?: WidgetSurface;
  widgets: DashboardWidget[];
  onAdd: (widget: DashboardWidget) => void;
};

export const WidgetPickerDialog = ({
  open,
  onClose,
  workspaceSlug,
  surface = 'workspace',
  widgets,
  onAdd
}: Props) => {
  const [pendingType, setPendingType] = useState<DashboardWidgetType | null>(null);
  const [selectedViewId, setSelectedViewId] = useState('');

  const { projectId } = useMdxContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
    includeWorkspace: true
  });
  const options = WIDGET_TYPE_OPTIONS.filter(option => option.surfaces.includes(surface));

  const handleClose = () => {
    setPendingType(null);
    setSelectedViewId('');
    onClose();
  };

  const handlePick = (type: DashboardWidgetType) => {
    if (type === 'saved-view-embed') {
      setPendingType(type);
      return;
    }
    onAdd(createDefaultWidget(type, widgets));
    handleClose();
  };

  const handleConfirmSavedView = () => {
    if (!selectedViewId) return;
    onAdd(createDefaultWidget('saved-view-embed', widgets, selectedViewId));
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add widget"
      width={420}
      buttons={
        pendingType === 'saved-view-embed'
          ? [
              { label: 'Cancel', type: 'cancel', onClick: handleClose },
              {
                label: 'Add',
                type: 'default',
                disabled: !selectedViewId,
                onClick: handleConfirmSavedView
              }
            ]
          : [{ label: 'Cancel', type: 'cancel', onClick: handleClose }]
      }
    >
      {pendingType === 'saved-view-embed' ? (
        <div className={styles.viewPicker}>
          <select
            className={styles.viewSelect}
            value={selectedViewId}
            onChange={e => setSelectedViewId(e.target.value)}
          >
            <option value="">Select a saved view…</option>
            {savedViews.map(view => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={styles.list}>
          {options.map(option => (
            <button
              key={option.type}
              type="button"
              className={styles.option}
              onClick={() => handlePick(option.type)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              <span className={styles.optionDescription}>{option.description}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
};
