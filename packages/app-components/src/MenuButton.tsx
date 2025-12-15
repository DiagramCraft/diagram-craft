import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';
import { Menu as _Menu } from './Menu';
import { Button } from './Button';
import React from 'react';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import styles from './Menu.module.css';

type RootProps = {
  children: React.ReactNode;
};

const Root = (props: RootProps) => {
  return (
    <_Menu.Context type={'menu'}>
      <BaseUIMenu.Root>{props.children}</BaseUIMenu.Root>
    </_Menu.Context>
  );
};

type TriggerProps = Button.Props | { element?: React.ReactElement };

const Trigger = (props: TriggerProps) => {
  if ('element' in props) {
    return <BaseUIMenu.Trigger render={props.element} />;
  } else if ('children' in props) {
    return <BaseUIMenu.Trigger render={<Button {...props} />}>{props.children}</BaseUIMenu.Trigger>;
  } else {
    VERIFY_NOT_REACHED();
  }
};

type MenuProps = {
  children: React.ReactNode;
} & Pick<React.HTMLAttributes<'div'>, 'className'>;

const Menu = (props: MenuProps) => {
  return (
    <BaseUIMenu.Portal>
      <BaseUIMenu.Positioner sideOffset={5}>
        <BaseUIMenu.Popup className={styles.cmpMenu} {...props}>
          {props.children}
          <BaseUIMenu.Arrow className={styles.cmpMenuArrow} />
        </BaseUIMenu.Popup>
      </BaseUIMenu.Positioner>
    </BaseUIMenu.Portal>
  );
};

export const MenuButton = {
  Root,
  Trigger,
  Menu
};
