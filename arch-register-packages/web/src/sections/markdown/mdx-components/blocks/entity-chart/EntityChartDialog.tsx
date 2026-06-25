import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { EntityChartSlateElement } from './types';
import styles from './EntityChartDialog.module.css';

const GROUP_BY_OPTIONS = [
  { value: 'lifecycle', label: 'Status' },
  { value: 'owner', label: 'Owner' },
  { value: 'schema', label: 'Type' }
];

const CHART_TYPE_OPTIONS = [
  { value: 'donut', label: 'Donut' },
  { value: 'bar', label: 'Bar' }
];

const hasFilter = (filter: EntityFilterValue) =>
  !!(filter.schemaId || filter.owner || filter.lifecycle);

export const EntityChartDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const el = element as EntityChartSlateElement;

  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: el.schema ?? '',
    owner: el.owner ?? '',
    lifecycle: el.lifecycle ?? ''
  });
  const [groupBy, setGroupBy] = useState(el.groupBy ?? 'lifecycle');
  const [chartType, setChartType] = useState(el.chartType ?? 'donut');

  const canSave = hasFilter(filter);

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    if (!canSave) {
      if (isNew) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(
      {
        schema: filter.schemaId,
        owner: filter.owner,
        lifecycle: filter.lifecycle,
        groupBy,
        chartType
      },
      { at: path }
    );
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Entity chart"
      width={460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <DialogSection label="Filters">
          <EntityFilterPanel
            value={filter}
            onChange={update => setFilter(prev => ({ ...prev, ...update }))}
          />
        </DialogSection>

        <DialogSection label="Chart settings">
          <div className={styles.options}>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Group by</span>
              <div className={styles.optionControl}>
                <Select.Root value={groupBy} onChange={value => setGroupBy(value ?? 'lifecycle')}>
                  {GROUP_BY_OPTIONS.map(option => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </label>
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Chart type</span>
              <div className={styles.optionControl}>
                <Select.Root value={chartType} onChange={value => setChartType(value ?? 'donut')}>
                  {CHART_TYPE_OPTIONS.map(option => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            </label>
          </div>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
