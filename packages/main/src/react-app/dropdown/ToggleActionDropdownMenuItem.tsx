import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { findKeyBindings, formatKeyBinding } from '../../canvas/keyMap.ts';
import React from 'react';
import { useActions } from '../context/ActionsContext.ts';
import { Action, ActionContext, ToggleAction } from '../../canvas/action.ts';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../useRedraw.tsx';

export const ToggleActionDropdownMenuItem = (props: Props) => {
  const redraw = useRedraw();
  const { actionMap, keyMap } = useActions();

  const action: Action = actionMap[props.action]!;

  return (
    <DropdownMenu.CheckboxItem
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.context ?? {})}
      checked={(action as ToggleAction).getState(props.context ?? {})}
      onCheckedChange={async () => {
        const res = (await props.onBeforeSelect?.()) ?? true;
        if (res === false) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action.execute(props.context ?? {}, res as any);
        redraw();
      }}
    >
      <DropdownMenu.ItemIndicator className="cmp-context-menu__item-indicator" forceMount={true}>
        <TbCheck />
      </DropdownMenu.ItemIndicator>
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindings(props.action, keyMap)[0])}
      </div>
    </DropdownMenu.CheckboxItem>
  );
};

type Props = {
  action: keyof ActionMap;
  context?: ActionContext;
  children: React.ReactNode;
  onBeforeSelect?: () => Promise<boolean | unknown>;
};
