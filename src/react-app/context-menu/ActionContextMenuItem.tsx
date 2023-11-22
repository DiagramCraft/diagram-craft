import * as ContextMenu from '@radix-ui/react-context-menu';
import { findKeyBindings, KeyMap } from '../../base-ui/keyMap.ts';
import React from 'react';

// TODO: Maybe attach listener to action and re-render when it changes?
export const ActionContextMenuItem = (props: Props) => {
  return (
    <ContextMenu.Item
      className="ContextMenuItem"
      disabled={!props.actionMap[props.action]?.enabled}
      onSelect={() => {
        props.actionMap[props.action]!.execute();
      }}
    >
      {props.children}{' '}
      <div className="RightSlot">{findKeyBindings(props.action, props.keyMap)}</div>
    </ContextMenu.Item>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  action: keyof ActionMap;
  children: React.ReactNode;
};
