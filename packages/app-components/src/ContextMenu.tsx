import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';
import React, { type ReactElement } from 'react';
import { Menu as _Menu } from './Menu';

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
};

const Trigger = (props: TriggerProps) => {
  return <BaseUIContextMenu.Trigger render={props.element} />;
};

type MenuProps = {
  children: React.ReactNode;
} & Pick<React.HTMLAttributes<'div'>, 'className'>;

const Menu = (props: MenuProps) => {
  return (
    <BaseUIContextMenu.Portal>
      <BaseUIContextMenu.Positioner>
        <BaseUIContextMenu.Popup className="cmp-context-menu" {...props}>
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
