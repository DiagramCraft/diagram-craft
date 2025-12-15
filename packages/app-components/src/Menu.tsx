import React, { type ReactElement } from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';
import { TbCheck, TbChevronRight } from 'react-icons/tb';
import styles from './Menu.module.css';

const MenuContext = React.createContext<{ type: 'context' | 'menu' } | undefined>(undefined);

const useMenuContext = () => {
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
  icon?: ReactElement;
  indicator?: ReactElement;
  keybinding?: ReactElement | string;
} & Pick<React.HTMLAttributes<'div'>, 'className'>;

const Item = (props: ItemProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return (
      <BaseUIContextMenu.Item className={styles.cmpMenuItem} {...props}>
        {props.icon && <div className={styles.cmpMenuItemIcon}>{props.icon}</div>}
        {props.indicator && <div className={styles.cmpMenuItemIndicator}>{props.indicator}</div>}
        <span>{props.children}</span>
        {props.keybinding && <div className={styles.cmpMenuRightSlot}>{props.keybinding}</div>}
      </BaseUIContextMenu.Item>
    );
  } else {
    return (
      <BaseUIMenu.Item className={styles.cmpMenuItem} {...props}>
        {props.icon && <div className={styles.cmpMenuItemIcon}>{props.icon}</div>}
        {props.indicator && <div className={styles.cmpMenuItemIndicator}>{props.indicator}</div>}
        <span>{props.children}</span>
        {props.keybinding && <div className={styles.cmpMenuRightSlot}>{props.keybinding}</div>}
      </BaseUIMenu.Item>
    );
  }
};

type SeparatorProps = {
  className?: string;
};

const Separator = (props: SeparatorProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return <BaseUIContextMenu.Separator className={styles.cmpMenuSeparator} {...props} />;
  } else {
    return <BaseUIMenu.Separator className={styles.cmpMenuSeparator} {...props} />;
  }
};

type RadioItemProps = {
  className?: string;
  value: string;
  onClick?: () => void;
  children: React.ReactNode;
};

const RadioItem = (props: RadioItemProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return (
      <BaseUIContextMenu.RadioItem
        className={styles.cmpMenuRadioItem}
        {...props}
        value={props.value}
      >
        <BaseUIContextMenu.RadioItemIndicator className={styles.cmpMenuItemIndicator}>
          <TbCheck />
        </BaseUIContextMenu.RadioItemIndicator>
        {props.children}
      </BaseUIContextMenu.RadioItem>
    );
  } else {
    return (
      <BaseUIMenu.RadioItem className={styles.cmpMenuRadioItem} {...props} value={props.value}>
        <BaseUIMenu.RadioItemIndicator className={styles.cmpMenuItemIndicator}>
          <TbCheck />
        </BaseUIMenu.RadioItemIndicator>
        {props.children}
      </BaseUIMenu.RadioItem>
    );
  }
};

type RadioGroupProps = {
  value: string;
  children: React.ReactNode;
};

const RadioGroup = (props: RadioGroupProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return (
      <BaseUIContextMenu.RadioGroup value={props.value}>
        {props.children}
      </BaseUIContextMenu.RadioGroup>
    );
  } else {
    return <BaseUIMenu.RadioGroup value={props.value}>{props.children}</BaseUIMenu.RadioGroup>;
  }
};

type CheckboxItemProps = {
  className?: string;
  onCheckedChange?: (state: boolean) => void;
  children: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  keybinding?: string;
};

const CheckboxItem = (props: CheckboxItemProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return (
      <BaseUIContextMenu.CheckboxItem className={styles.cmpMenuCheckboxItem} {...props}>
        <BaseUIContextMenu.CheckboxItemIndicator className={styles.cmpMenuItemIndicator}>
          <TbCheck />
        </BaseUIContextMenu.CheckboxItemIndicator>
        {props.children}
        {props.keybinding && <div className={styles.cmpMenuRightSlot}>{props.keybinding}</div>}
      </BaseUIContextMenu.CheckboxItem>
    );
  } else {
    return (
      <BaseUIMenu.CheckboxItem className={styles.cmpMenuCheckboxItem} {...props}>
        <BaseUIMenu.CheckboxItemIndicator className={styles.cmpMenuItemIndicator}>
          <TbCheck />
        </BaseUIMenu.CheckboxItemIndicator>
        {props.children}
        {props.keybinding && <div className={styles.cmpMenuRightSlot}>{props.keybinding}</div>}
      </BaseUIMenu.CheckboxItem>
    );
  }
};

type SubMenuProps = {
  label: string;
  children: React.ReactNode;
  icon?: ReactElement;
  disabled?: boolean;
};

const SubMenu = (props: SubMenuProps) => {
  const type = useMenuContext();
  if (type === 'context') {
    return (
      <BaseUIContextMenu.SubmenuRoot>
        <BaseUIContextMenu.SubmenuTrigger
          className={styles.cmpMenuSubTrigger}
          disabled={props.disabled}
        >
          {props.icon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              {props.icon}
              <div>{props.label}</div>
            </div>
          )}
          {!props.icon && props.label}
          <div className={styles.cmpMenuRightSlot}>
            <TbChevronRight />
          </div>
        </BaseUIContextMenu.SubmenuTrigger>
        <BaseUIContextMenu.Portal>
          <BaseUIContextMenu.Positioner sideOffset={2} alignOffset={-5}>
            <BaseUIContextMenu.Popup className={styles.cmpMenu}>
              {props.children}
            </BaseUIContextMenu.Popup>
          </BaseUIContextMenu.Positioner>
        </BaseUIContextMenu.Portal>
      </BaseUIContextMenu.SubmenuRoot>
    );
  } else {
    return (
      <BaseUIMenu.SubmenuRoot>
        <BaseUIMenu.SubmenuTrigger className={styles.cmpMenuSubTrigger} disabled={props.disabled}>
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
  }
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
