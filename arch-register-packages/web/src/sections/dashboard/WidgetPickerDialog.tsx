import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useMdxContext } from '../markdown/MdxContext';
import { createDefaultWidget, type WidgetSurface } from './dashboardWidgetDefaults';
import { getDashboardWidgetSpecs } from './dashboardWidgetRegistry';
import { WikiPagePicker } from './widgets/WikiPagePicker';
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
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [selectedWikiPageId, setSelectedWikiPageId] = useState('');

  const { projectId } = useMdxContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
    includeWorkspace: true
  });
  const options = getDashboardWidgetSpecs().filter(({ spec }) => spec.surfaces.includes(surface));

  const handleClose = () => {
    setPendingType(null);
    setSelectedViewId('');
    setSelectedWikiPageId('');
    onClose();
  };

  const handlePick = (type: string) => {
    if (type === 'EntityViewEmbed') {
      setPendingType(type);
      return;
    }
    if (type === 'wiki-page') {
      setPendingType(type);
      return;
    }
    onAdd(createDefaultWidget(type, widgets));
    handleClose();
  };

  const handleConfirmSavedView = () => {
    if (!selectedViewId) return;
    onAdd(createDefaultWidget('EntityViewEmbed', widgets, selectedViewId));
    handleClose();
  };

  const handleConfirmWikiPage = () => {
    if (!selectedWikiPageId) return;
    onAdd({
      ...createDefaultWidget('wiki-page', widgets),
      config: { nodeId: selectedWikiPageId }
    });
    handleClose();
  };

  const isSelectingWikiPage = pendingType === 'wiki-page';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add widget"
      width={420}
      buttons={
        pendingType === 'EntityViewEmbed' || isSelectingWikiPage
          ? [
              { label: 'Cancel', type: 'cancel', onClick: handleClose },
              {
                label: 'Add',
                type: 'default',
                disabled: isSelectingWikiPage ? !selectedWikiPageId : !selectedViewId,
                onClick: isSelectingWikiPage ? handleConfirmWikiPage : handleConfirmSavedView
              }
            ]
          : [{ label: 'Cancel', type: 'cancel', onClick: handleClose }]
      }
    >
      {pendingType === 'EntityViewEmbed' ? (
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
      ) : isSelectingWikiPage ? (
        <div className={styles.viewPicker}>
          <WikiPagePicker
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            surface={surface}
            value={selectedWikiPageId}
            onChange={setSelectedWikiPageId}
          />
        </div>
      ) : (
        <div className={styles.list}>
          {options.map(({ type, spec }) => (
            <button
              key={type}
              type="button"
              className={styles.option}
              onClick={() => handlePick(type)}
            >
              <span className={styles.optionLabel}>{spec.label}</span>
              <span className={styles.optionDescription}>{spec.description}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
};
