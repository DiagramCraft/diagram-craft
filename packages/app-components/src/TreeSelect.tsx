import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';
import { TbChevronRight, TbDots } from 'react-icons/tb';
import { usePortal } from './PortalContext';
import styles from './Select.module.css';
import { extractDataAttributes } from './utils';
import { CSSProperties, useState } from 'react';

const ItemsList = (props: { items: Item[]; onValueChange: (v: string) => void }) => {
  const portal = usePortal();

  return (
    <>
      {props.items.map(item => {
        if (item.items && item.items.length > 0) {
          return (
            <BaseUIMenu.SubmenuRoot key={item.value}>
              <BaseUIMenu.SubmenuTrigger className="cmp-context-menu__sub-trigger">
                {item.label}
                <div className="cmp-context-menu__right-slot">
                  <TbChevronRight />
                </div>
              </BaseUIMenu.SubmenuTrigger>
              <BaseUIMenu.Portal container={portal}>
                <BaseUIMenu.Positioner sideOffset={2} alignOffset={-5}>
                  <BaseUIMenu.Popup className="cmp-context-menu">
                    <ItemsList items={item.items} onValueChange={props.onValueChange} />
                  </BaseUIMenu.Popup>
                </BaseUIMenu.Positioner>
              </BaseUIMenu.Portal>
            </BaseUIMenu.SubmenuRoot>
          );
        } else {
          return (
            <BaseUIMenu.Item
              key={item.value}
              className={'cmp-context-menu__item'}
              onClick={() => props.onValueChange(item.value)}
            >
              {item.label}
            </BaseUIMenu.Item>
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
    <BaseUIMenu.Root open={props.open}>
      <BaseUIMenu.Trigger
        className={styles.cmpSelectTrigger}
        {...extractDataAttributes(props)}
        disabled={props.disabled}
      >
        {props.hasMultipleValues ? (
          <div style={{ color: 'var(--panel-fg)' }}>···</div>
        ) : (
          (valueLabel ?? props.placeholder ?? '')
        )}
        <div className={styles.cmpSelectTriggerIcon}>
          <TbDots />
        </div>
      </BaseUIMenu.Trigger>

      <BaseUIMenu.Portal container={portal}>
        <BaseUIMenu.Positioner sideOffset={1} align={'start'} alignOffset={0}>
          <BaseUIMenu.Popup className={'cmp-context-menu'}>
            <ItemsList
              items={props.items}
              onValueChange={v => {
                props.onValueChange(v);
                setValue(v);
              }}
            />

            <BaseUIMenu.Arrow className="cmp-context-menu__arrow" />
          </BaseUIMenu.Popup>
        </BaseUIMenu.Positioner>
      </BaseUIMenu.Portal>
    </BaseUIMenu.Root>
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
