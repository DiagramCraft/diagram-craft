import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React from 'react';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';

export function ActionDropdownMenuItem<
  K extends keyof DiagramCraft.ActionMap,
  P = Parameters<DiagramCraft.ActionMap[K]['execute']>[0]
>(props: Props<K, P>) {
  const application = useApplication();
  const actionMap = application.actions;
  const keyMap = application.keyMap;

  return (
    <DropdownMenu.Item
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      onSelect={async () => {
        const a = actionMap[props.action]!;
        a.execute(props.arg ?? {});
      }}
    >
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </DropdownMenu.Item>
  );
}

type Props<
  K extends keyof DiagramCraft.ActionMap,
  P = Parameters<DiagramCraft.ActionMap[K]['execute']>[0]
> = {
  action: K;
  children: React.ReactNode;
} & (P extends undefined ? { arg?: never } : { arg: P });
