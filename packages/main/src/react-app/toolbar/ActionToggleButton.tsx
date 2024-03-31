import * as ReactToolbar from '@radix-ui/react-toolbar';
import React from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useActions } from '../context/ActionsContext.ts';
import { ToggleAction } from '../../base-ui/action.ts';
import { ActionName } from '../../base-ui/keyMap.ts';

export const ActionToggleButton = (props: Props) => {
  const { actionMap } = useActions();
  const redraw = useRedraw();
  useEventListener(actionMap[props.action]!, 'actionchanged', redraw);

  return (
    <ReactToolbar.Button
      className="cmp-toolbar__button"
      data-state={(actionMap[props.action]! as ToggleAction).getState({}) ? 'on' : 'off'}
      value={props.action}
      aria-label={props.action}
      onClick={() => {
        actionMap[props.action]!.execute({});
      }}
    >
      {props.children}
    </ReactToolbar.Button>
  );
};

type Props = {
  action: ActionName;
  children: React.ReactNode;
};
