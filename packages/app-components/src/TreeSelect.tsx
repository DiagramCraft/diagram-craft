import * as ReactDropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbChevronRight, TbDotsDiagonal2 } from 'react-icons/tb';
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
            <ReactDropdownMenu.Sub>
              <ReactDropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                {item.label}
                <div className="cmp-context-menu__right-slot">
                  <TbChevronRight />
                </div>
              </ReactDropdownMenu.SubTrigger>
              <ReactDropdownMenu.Portal container={portal}>
                <ReactDropdownMenu.SubContent
                  className="cmp-context-menu"
                  sideOffset={2}
                  alignOffset={-5}
                >
                  <ItemsList items={item.items} onValueChange={props.onValueChange} />
                </ReactDropdownMenu.SubContent>
              </ReactDropdownMenu.Portal>
            </ReactDropdownMenu.Sub>
          );
        } else {
          return (
            <ReactDropdownMenu.Item
              className={'cmp-context-menu__item'}
              onClick={() => props.onValueChange(item.value)}
            >
              {item.label}
            </ReactDropdownMenu.Item>
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
    <ReactDropdownMenu.Root open={props.open}>
      <ReactDropdownMenu.Trigger asChild>
        <button
          className={styles.cmpSelectTrigger}
          {...extractDataAttributes(props)}
          disabled={props.disabled}
        >
          {props.hasMultipleValues ? (
            <div style={{ color: 'var(--primary-fg)' }}>···</div>
          ) : (
            valueLabel ?? props.placeholder ?? ''
          )}
          <div className={styles.cmpSelectTriggerIcon}>
            <TbDotsDiagonal2 />
          </div>
        </button>
      </ReactDropdownMenu.Trigger>

      <ReactDropdownMenu.Portal container={portal}>
        <ReactDropdownMenu.Content
          className={'cmp-context-menu'}
          sideOffset={1}
          align={'start'}
          alignOffset={0}
        >
          <ItemsList
            items={props.items}
            onValueChange={v => {
              props.onValueChange(v);
              setValue(v);
            }}
          />

          <ReactDropdownMenu.Arrow className="cmp-context-menu__arrow" />
        </ReactDropdownMenu.Content>
      </ReactDropdownMenu.Portal>
    </ReactDropdownMenu.Root>
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
