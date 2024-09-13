import * as ContextMenu from '@radix-ui/react-context-menu';
import React from 'react';
import { useActions } from '../context/ActionsContext';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';

export function ActionContextMenuItem<K extends keyof ActionMap>(props: Props<K>) {
  const { actionMap, keyMap } = useActions();

  return (
    <ContextMenu.Item
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      onSelect={async () => {
        const a = actionMap[props.action]!;
        a.execute(props.arg);
      }}
    >
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </ContextMenu.Item>
  );
}

type Props<K extends keyof ActionMap> = {
  action: K;
  arg: Parameters<ActionMap[K]['execute']>[0];
  children: React.ReactNode;
};
