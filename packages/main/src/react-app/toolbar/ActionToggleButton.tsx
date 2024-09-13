import React from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import { useActions } from '../context/ActionsContext';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { ActionName } from '@diagram-craft/canvas/keyMap';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';

export const ActionToggleButton = (props: Props) => {
  const { actionMap } = useActions();
  const redraw = useRedraw();
  useEventListener(actionMap[props.action]!, 'actionChanged', redraw);

  return (
    <Toolbar.ToggleGroup type={'single'}>
      <Toolbar.ToggleItem
        data-state={(actionMap[props.action]! as ToggleAction).getState({}) ? 'on' : 'off'}
        value={props.action}
        aria-label={props.action}
        onClick={() => {
          actionMap[props.action]!.execute({});
        }}
      >
        {props.children}
      </Toolbar.ToggleItem>
    </Toolbar.ToggleGroup>
  );
};

type Props = {
  action: ActionName;
  children: React.ReactNode;
};
