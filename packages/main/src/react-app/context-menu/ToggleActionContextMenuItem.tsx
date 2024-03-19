import * as ContextMenu from '@radix-ui/react-context-menu';
import { findKeyBindings, formatKeyBinding } from '../../base-ui/keyMap.ts';
import React from 'react';
import { useActions } from '../context/ActionsContext.tsx';
import { Action, ActionContext, ToggleAction } from '../../base-ui/action.ts';
import { TbCheck } from 'react-icons/tb';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';

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
        const res = (await props.onBeforeSelect?.()) ?? true;
        if (res === false) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action.execute(props.context ?? {}, res as any);
        redraw();
      }}
    >
      <ContextMenu.ItemIndicator className="cmp-context-menu__item-indicator" forceMount={true}>
        <TbCheck />
      </ContextMenu.ItemIndicator>
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">
        {formatKeyBinding(findKeyBindings(props.action, keyMap)[0])}
      </div>
    </ContextMenu.CheckboxItem>
  );
};

type Props = {
  action: keyof ActionMap;
  context?: ActionContext;
  children: React.ReactNode;
  onBeforeSelect?: () => Promise<boolean | unknown>;
};
