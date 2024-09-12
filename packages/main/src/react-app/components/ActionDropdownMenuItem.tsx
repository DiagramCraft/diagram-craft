import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React from 'react';
import { useActions } from '../context/ActionsContext';
import { Action, ActionContext } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';

export const ActionDropdownMenuItem = (props: Props) => {
  const { actionMap, keyMap } = useActions();

  return (
    <DropdownMenu.Item
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.context ?? {})}
      onSelect={async () => {
        const a: Action = actionMap[props.action]!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        a.execute(props.context ?? {});
      }}
    >
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </DropdownMenu.Item>
  );
};

type Props = {
  action: keyof ActionMap;
  context?: ActionContext;
  children: React.ReactNode;
};
