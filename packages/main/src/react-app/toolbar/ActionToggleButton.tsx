import React from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { ActionName } from '@diagram-craft/canvas/keyMap';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useApplication } from '../../application';

export const ActionToggleButton = (props: Props) => {
  const application = useApplication();
  const actionMap = application.actions;
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
        disabled={!actionMap[props.action]!.isEnabled(undefined)}
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
