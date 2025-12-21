import React, { type ReactElement } from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';
import { TbCheck, TbChevronRight } from 'react-icons/tb';
import styles from './Menu.module.css';

const MenuContext = React.createContext<{ type: 'context' | 'menu' } | undefined>(undefined);

// @ts-expect-error Keeping for reference
const _useMenuContext = () => {
  const context = React.useContext(MenuContext);
  assert.present(context);
  return context.type;
};

type ContextProps = { type: 'context' | 'menu'; children: React.ReactNode };

const Context = (props: ContextProps) => {
  return <MenuContext.Provider value={props}>{props.children}</MenuContext.Provider>;
};

type ItemProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  leftSlot?: ReactElement;
  rightSlot?: ReactElement | string;
  className?: string;
};

const Item = (props: ItemProps) => {
  return (
    <BaseUIMenu.Item
      className={props.className ?? styles.cmpMenuItem}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.leftSlot && <div className={styles.cmpMenuLeftSlot}>{props.leftSlot}</div>}
      <span>{props.children}</span>
      {props.rightSlot && <div className={styles.cmpMenuRightSlot}>{props.rightSlot}</div>}
    </BaseUIMenu.Item>
  );
};

type SeparatorProps = {
  className?: string;
};

const Separator = (props: SeparatorProps) => {
  return <BaseUIMenu.Separator className={props.className ?? styles.cmpMenuSeparator} />;
};

type RadioItemProps = {
  className?: string;
  value: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  rightSlot?: string | ReactElement;
};

const RadioItem = (props: RadioItemProps) => {
  return (
    <BaseUIMenu.RadioItem
      className={styles.cmpMenuRadioItem}
      disabled={props.disabled}
      value={props.value}
      onClick={props.onClick}
    >
      <BaseUIMenu.RadioItemIndicator className={styles.cmpMenuLeftSlot}>
        <TbCheck />
      </BaseUIMenu.RadioItemIndicator>
      {props.children}
      {props.rightSlot && <div className={styles.cmpMenuRightSlot}>{props.rightSlot}</div>}
    </BaseUIMenu.RadioItem>
  );
};

type RadioGroupProps = {
  value: string;
  children: React.ReactNode;
};

const RadioGroup = (props: RadioGroupProps) => {
  return <BaseUIMenu.RadioGroup value={props.value}>{props.children}</BaseUIMenu.RadioGroup>;
};

type CheckboxItemProps = {
  className?: string;
  onCheckedChange?: (state: boolean) => void;
  children: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  rightSlot?: string;
};

const CheckboxItem = (props: CheckboxItemProps) => {
  return (
    <BaseUIMenu.CheckboxItem
      className={props.className ?? styles.cmpMenuCheckboxItem}
      disabled={props.disabled}
      checked={props.checked}
      onCheckedChange={props.onCheckedChange}
    >
      <BaseUIMenu.CheckboxItemIndicator className={styles.cmpMenuLeftSlot}>
        <TbCheck />
      </BaseUIMenu.CheckboxItemIndicator>
      {props.children}
      {props.rightSlot && <div className={styles.cmpMenuRightSlot}>{props.rightSlot}</div>}
    </BaseUIMenu.CheckboxItem>
  );
};

type SubMenuProps = {
  label: string;
  children: React.ReactNode;
  leftSlot?: ReactElement;
  disabled?: boolean;
};

const SubMenu = (props: SubMenuProps) => {
  return (
    <BaseUIMenu.SubmenuRoot>
      <BaseUIMenu.SubmenuTrigger className={styles.cmpMenuSubTrigger} disabled={props.disabled}>
        {props.leftSlot && <div className={styles.cmpMenuLeftSlot}>{props.leftSlot}</div>}
        {props.label}
        <div className={styles.cmpMenuRightSlot}>
          <TbChevronRight />
        </div>
      </BaseUIMenu.SubmenuTrigger>
      <BaseUIMenu.Portal>
        <BaseUIMenu.Positioner sideOffset={2} alignOffset={-5}>
          <BaseUIContextMenu.Popup className={styles.cmpMenu}>
            {props.children}
          </BaseUIContextMenu.Popup>
        </BaseUIMenu.Positioner>
      </BaseUIMenu.Portal>
    </BaseUIMenu.SubmenuRoot>
  );
};

export const Menu = {
  Context,
  Item,
  Separator,
  RadioItem,
  RadioGroup,
  SubMenu,
  CheckboxItem
};
