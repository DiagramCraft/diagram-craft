import { TbDots } from 'react-icons/tb';
import { extractDataAttributes } from './utils';
import { CSSProperties, useState } from 'react';
import selectStyles from './Select.module.css';
import { MenuButton } from './MenuButton';
import { Menu } from './Menu';
import { usePortal } from './PortalContext';

const ItemsList = (props: { items: Item[]; onValueChange: (v: string) => void }) => {
  return (
    <>
      {props.items.map(item => {
        if (item.items && item.items.length > 0) {
          return (
            <Menu.SubMenu key={item.value} label={item.label}>
              <ItemsList items={item.items} onValueChange={props.onValueChange} />
            </Menu.SubMenu>
          );
        } else {
          return (
            <Menu.Item key={item.value} onClick={() => props.onValueChange(item.value)}>
              {item.label}
            </Menu.Item>
          );
        }
      })}
    </>
  );
};

const recursiveFind = (items: Item[], value: string): string | undefined => {
  for (const item of items) {
    if (item.value === value) {
      return item.label;
    }
    if (item.items) {
      const result = recursiveFind(item.items, value);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
};

const Root = (props: RootProps) => {
  const portal = usePortal();
  const [value, setValue] = useState(props.hasMultipleValues ? undefined : props.value);

  const valueLabel = recursiveFind(props.items, value ?? '');

  return (
    <MenuButton.Root open={props.open}>
      <MenuButton.Trigger
        className={selectStyles.cmpSelectTrigger}
        {...extractDataAttributes(props)}
        disabled={props.disabled}
      >
        {props.hasMultipleValues ? (
          <div style={{ color: 'var(--panel-fg)' }}>···</div>
        ) : (
          (valueLabel ?? props.placeholder ?? '')
        )}
        <div className={selectStyles.cmpSelectTriggerIcon}>
          <TbDots />
        </div>
      </MenuButton.Trigger>
      <MenuButton.Menu container={portal} align={'start'}>
        <ItemsList
          items={props.items}
          onValueChange={v => {
            props.onValueChange(v);
            setValue(v);
          }}
        />
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
type RootProps = {
  hasMultipleValues?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  open?: boolean;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  items: Item[];
};

type Item = {
  label: string;
  value: string;
  items?: Item[];
};

export const TreeSelect = {
  Root
};
