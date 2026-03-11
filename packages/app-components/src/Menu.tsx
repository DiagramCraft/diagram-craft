import React, { type ReactElement } from 'react';
import { ContextMenu as BaseUIContextMenu } from '@base-ui/react/context-menu';
import { Menu as BaseUIMenu } from '@base-ui/react/menu';
import { TbCheck, TbChevronRight } from 'react-icons/tb';
import styles from './Menu.module.css';

const MenuContext = React.createContext<{ type: 'context' | 'menu' } | undefined>(undefined);

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
      className={props.className ?? styles.eItem}
      disabled={props.disabled}
      onClick={props.onClick}
      data-type={'regular'}
    >
      {props.leftSlot && <div className={styles.eItemLeftSlot}>{props.leftSlot}</div>}
      <span>{props.children}</span>
      {props.rightSlot && <div className={styles.eItemRightSlot}>{props.rightSlot}</div>}
    </BaseUIMenu.Item>
  );
};

type SeparatorProps = {
  className?: string;
};

const Separator = (props: SeparatorProps) => {
  return <BaseUIMenu.Separator className={props.className ?? styles.eSeparator} />;
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
      className={styles.eItem}
      data-type={'radio'}
      disabled={props.disabled}
      value={props.value}
      onClick={props.onClick}
    >
      <BaseUIMenu.RadioItemIndicator className={styles.eItemLeftSlot}>
        <TbCheck />
      </BaseUIMenu.RadioItemIndicator>
      {props.children}
      {props.rightSlot && <div className={styles.eItemRightSlot}>{props.rightSlot}</div>}
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
      className={props.className ?? styles.eItem}
      data-type={'checkbox'}
      disabled={props.disabled}
      checked={props.checked}
      onCheckedChange={props.onCheckedChange}
    >
      <BaseUIMenu.CheckboxItemIndicator className={styles.eItemLeftSlot}>
        <TbCheck />
      </BaseUIMenu.CheckboxItemIndicator>
      {props.children}
      {props.rightSlot && <div className={styles.eItemRightSlot}>{props.rightSlot}</div>}
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
      <BaseUIMenu.SubmenuTrigger
        className={styles.eItem}
        disabled={props.disabled}
        data-type={'submenu-trigger'}
      >
        {props.leftSlot && <div className={styles.eItemLeftSlot}>{props.leftSlot}</div>}
        {props.label}
        <div className={styles.eItemRightSlot}>
          <TbChevronRight />
        </div>
      </BaseUIMenu.SubmenuTrigger>
      <BaseUIMenu.Portal>
        <BaseUIMenu.Positioner sideOffset={2} alignOffset={-5}>
          <BaseUIContextMenu.Popup className={styles.cMenu}>
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
