import React from 'react';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../hooks/useRedraw';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { findKeyBindingsForAction, formatKeyBinding } from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';
import type { ActionMap } from '@diagram-craft/canvas/actions/action';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';

export function ToggleActionDropdownMenuItem<
  K extends keyof ActionMap,
  P = Parameters<ActionMap[K]['execute']>[0]
>(props: Props<K, P>) {
  const redraw = useRedraw();
  const application = useApplication();
  const actionMap = application.actions;
  const keyMap = application.keyMap;

  const action = actionMap[props.action]!;

  return (
    <BaseUIMenu.CheckboxItem
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.isEnabled(props.arg ?? {})}
      checked={(action as ToggleAction).getState(props.arg ?? {})}
      onCheckedChange={async () => {
        action.execute(props.arg ?? {});
        redraw();
      }}
    >
      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
        <TbCheck />
      </BaseUIMenu.CheckboxItemIndicator>
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindingsForAction(props.action, keyMap)[0])}
      </div>
    </BaseUIMenu.CheckboxItem>
  );
}

type Props<K extends keyof ActionMap, P = Parameters<ActionMap[K]['execute']>[0]> = {
  action: K;
  children: React.ReactNode;
} & (P extends undefined ? { arg?: never } : { arg: P });
