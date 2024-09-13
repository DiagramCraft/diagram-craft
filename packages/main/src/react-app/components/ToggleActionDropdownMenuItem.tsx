import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React from 'react';
import { useActions } from '../context/ActionsContext';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../hooks/useRedraw';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';

export function ToggleActionDropdownMenuItem<
  K extends keyof ActionMap,
  P = Parameters<ActionMap[K]['execute']>[0]
>(props: Props<K, P>) {
  const redraw = useRedraw();
  const { actionMap, keyMap } = useActions();

  const action = actionMap[props.action]!;

  return (
    <DropdownMenu.CheckboxItem
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      checked={(action as ToggleAction).getState(props.arg ?? {})}
      onCheckedChange={async () => {
        action.execute(props.arg ?? {});
        redraw();
      }}
    >
      <DropdownMenu.ItemIndicator className="cmp-context-menu__item-indicator" forceMount={true}>
        <TbCheck />
      </DropdownMenu.ItemIndicator>
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </DropdownMenu.CheckboxItem>
  );
}

type Props<K extends keyof ActionMap, P = Parameters<ActionMap[K]['execute']>[0]> = {
  action: K;
  children: React.ReactNode;
} & (P extends undefined ? { arg?: never } : { arg: P });
