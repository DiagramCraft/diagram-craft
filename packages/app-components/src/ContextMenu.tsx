import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';
import React, { type ReactElement } from 'react';
import { Menu as _Menu } from './Menu';
import styles from './Menu.module.css';
import { Tooltip } from './Tooltip';

type RootProps = {
  children: React.ReactNode;
};

const Root = (props: RootProps) => {
  return (
    <_Menu.Context type={'context'}>
      <BaseUIContextMenu.Root>{props.children}</BaseUIContextMenu.Root>
    </_Menu.Context>
  );
};

type TriggerProps = {
  element: ReactElement;
  tooltip?: string | React.ReactNode;
};

const Trigger = (props: TriggerProps) => {
  if (props.tooltip) {
    return (
      <Tooltip
        message={props.tooltip}
        element={<BaseUIContextMenu.Trigger render={props.element} />}
      />
    );
  } else {
    return <BaseUIContextMenu.Trigger render={props.element} />;
  }
};

type MenuProps = {
  children: React.ReactNode;
  className?: string;
};

const Menu = (props: MenuProps) => {
  return (
    <BaseUIContextMenu.Portal>
      <BaseUIContextMenu.Positioner>
        <BaseUIContextMenu.Popup className={props.className ?? styles.cmpMenu}>
          {props.children}
        </BaseUIContextMenu.Popup>
      </BaseUIContextMenu.Positioner>
    </BaseUIContextMenu.Portal>
  );
};

export const ContextMenu = {
  Root,
  Trigger,
  Menu
};
