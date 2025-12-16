import React from 'react';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';
import type { ActionMap } from '@diagram-craft/canvas/actions/action';
import { Menu } from '@diagram-craft/app-components/Menu';

export function ActionMenuItem<
  K extends keyof ActionMap,
  P = Parameters<ActionMap[K]['execute']>[0]
>(props: Props<K, P>) {
  const application = useApplication();
  const actionMap = application.actions;
  const keyMap = application.keyMap;

  return (
    <Menu.Item
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      onClick={async () => {
        const a = actionMap[props.action]!;
        a.execute(props.arg ?? {});
      }}
      rightSlot={formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
    >
      {props.children ?? actionMap[props.action]!.name}
    </Menu.Item>
  );
}

type Props<K extends keyof ActionMap, P = Parameters<ActionMap[K]['execute']>[0]> = {
  action: K;
  children?: React.ReactNode;
} & (P extends undefined ? { arg?: never } : { arg: P });
