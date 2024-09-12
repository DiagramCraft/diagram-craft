import * as ContextMenu from '@radix-ui/react-context-menu';
import React from 'react';
import { useActions } from '../context/ActionsContext';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../hooks/useRedraw';
import { Action, ActionContext, ToggleAction } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';

export const ToggleActionContextMenuItem = (props: Props) => {
  const redraw = useRedraw();
  const { actionMap, keyMap } = useActions();

  const action: Action = actionMap[props.action]!;

  return (
    <ContextMenu.CheckboxItem
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.context ?? {})}
      checked={(action as ToggleAction).getState(props.context ?? {})}
      onCheckedChange={async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action.execute(props.context ?? {});
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
};

type Props = {
  action: keyof ActionMap;
  context?: ActionContext;
  children: React.ReactNode;
};
