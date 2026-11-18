import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { TbArrowDown, TbArrowUp, TbColumns3 } from 'react-icons/tb';
import { ToolbarButton } from '../ToolbarButton';
import { moveColumn } from './useColumnLayout';
import styles from './ColumnChooser.module.css';

export type ColumnChooserItem = {
  id: string;
  label: string;
  visible: boolean;
  hideable: boolean;
};

type Props = {
  // Columns in their current display order
  columns: ColumnChooserItem[];
  onVisibilityChange: (id: string, visible: boolean) => void;
  onOrderChange: (order: string[]) => void;
  onReset: () => void;
};

export const ColumnChooser = ({ columns, onVisibilityChange, onOrderChange, onReset }: Props) => {
  const order = columns.map(c => c.id);
  return (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <ToolbarButton aria-label="Choose columns" title="Choose columns">
            <TbColumns3 />
          </ToolbarButton>
        }
      />
      <MenuButton.Menu align="end">
        {columns.map((c, i) => (
          <div key={c.id} className={styles.row}>
            <div className={styles.rowItem}>
              <Menu.CheckboxItem
                checked={c.visible}
                disabled={!c.hideable}
                onCheckedChange={visible => onVisibilityChange(c.id, visible)}
              >
                {c.label}
              </Menu.CheckboxItem>
            </div>
            <button
              type="button"
              className={styles.move}
              aria-label={`Move ${c.label} up`}
              disabled={i === 0}
              onClick={() => onOrderChange(moveColumn(order, c.id, -1))}
            >
              <TbArrowUp />
            </button>
            <button
              type="button"
              className={styles.move}
              aria-label={`Move ${c.label} down`}
              disabled={i === columns.length - 1}
              onClick={() => onOrderChange(moveColumn(order, c.id, 1))}
            >
              <TbArrowDown />
            </button>
          </div>
        ))}
        <Menu.Separator />
        <Menu.Item onClick={onReset}>Reset columns</Menu.Item>
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
