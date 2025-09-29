import * as ContextMenu from '@radix-ui/react-context-menu';
import React from 'react';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../hooks/useRedraw';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';

export function ToggleActionContextMenuItem<K extends keyof ActionMap>(props: Props<K>) {
  const redraw = useRedraw();
  const application = useApplication();
  const actionMap = application.actions;
  const keyMap = application.keyMap;

  const action = actionMap[props.action]!;

  return (
    <ContextMenu.CheckboxItem
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      checked={(action as ToggleAction).getState(props.arg ?? {})}
      onCheckedChange={async () => {
        action.execute(props.arg ?? {});
        redraw();
      }}
    >
      <ContextMenu.ItemIndicator className="cmp-context-menu__item-indicator" forceMount={true}>
        <TbCheck />
      </ContextMenu.ItemIndicator>
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </ContextMenu.CheckboxItem>
  );
}

type Props<K extends keyof ActionMap> = {
  action: K;
  arg?: Parameters<ActionMap[K]['execute']>[0];
  children: React.ReactNode;
};
