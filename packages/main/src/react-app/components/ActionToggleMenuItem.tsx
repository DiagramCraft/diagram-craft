import React from 'react';
import { useRedraw } from '../hooks/useRedraw';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';
import type { ActionMap } from '@diagram-craft/canvas/actions/action';
import { Menu } from '@diagram-craft/app-components/Menu';

export function ActionToggleMenuItem<K extends keyof ActionMap>(props: Props<K>) {
  const redraw = useRedraw();
  const application = useApplication();
  const actionMap = application.actions;
  const keyMap = application.keyMap;

  const action = actionMap[props.action]!;

  return (
    <Menu.CheckboxItem
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      checked={(action as ToggleAction).getState(props.arg ?? {})}
      onCheckedChange={async () => {
        action.execute(props.arg ?? {});
        redraw();
      }}
      rightSlot={formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
    >
      {props.children}
    </Menu.CheckboxItem>
  );
}

type Props<K extends keyof ActionMap> = {
  action: K;
  arg?: Parameters<ActionMap[K]['execute']>[0];
  children: React.ReactNode;
};
