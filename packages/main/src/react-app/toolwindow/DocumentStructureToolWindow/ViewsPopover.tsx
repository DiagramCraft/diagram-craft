import { TbTrash } from 'react-icons/tb';
import { useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { type Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './ViewsPopover.module.css';

const applyView = (diagram: Diagram, targetLayerIds: Set<string>) => {
  for (const layer of diagram.layers.all) {
    const shouldBeVisible = targetLayerIds.has(layer.id);
    const isVisible = diagram.layers.visible.includes(layer);
    if (shouldBeVisible !== isVisible) {
      diagram.layers.toggleVisibility(layer);
    }
  }
};

export const ViewsPopover = (props: { diagram: Diagram; onClose: () => void }) => {
  const { diagram, onClose } = props;
  const redraw = useRedraw();
  const [newViewName, setNewViewName] = useState('');

  useEventListener(diagram, 'viewsChange', redraw);

  const saveView = () => {
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    diagram.addView(trimmed);
    setNewViewName('');
    onClose();
  };

  return (
    <div className={styles.icViewsPopover}>
      <h2>Views</h2>
      {diagram.views.length === 0 && <div className={styles.eEmpty}>No views saved yet</div>}
      {diagram.views.map(view => (
        <div key={view.id} className={styles.eViewRow}>
          <span
            className={styles.eViewName}
            onClick={() => applyView(diagram, new Set(view.layers))}
          >
            {view.name}
          </span>
          <span className={styles.eDeleteBtn} onClick={() => diagram.removeView(view.id)}>
            <TbTrash />
          </span>
        </div>
      ))}

      <div className={styles.eSaveRow}>
        <div>
          <div className={styles.eLabel}>Save current view:</div>
          <div className={styles.eForm}>
            <TextInput
              value={newViewName}
              onChange={value => setNewViewName(value ?? '')}
              placeholder="View name…"
              onKeyDown={e => {
                if (e.key === 'Enter') saveView();
              }}
            />
            <Button variant="primary" onClick={saveView}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
