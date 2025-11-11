import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../hooks/useRedraw';
import React, { useId } from 'react';
import { ToggleAction } from '@diagram-craft/canvas/action';
import { useApplication } from '../../application';
import type { ActionMap } from '@diagram-craft/canvas/actions/action';

export const ActionCheckbox = (props: Props) => {
  const application = useApplication();
  const actionMap = application.actions;
  const id = useId();
  const redraw = useRedraw();

  useEventListener(actionMap[props.action]!, 'actionChanged', ({ action }) => {
    if (action === actionMap[props.action]) redraw();
  });

  return (
    <>
      <input
        id={id}
        type={'checkbox'}
        checked={(actionMap[props.action] as ToggleAction).getState({})}
        onChange={() => {
          (actionMap[props.action] as ToggleAction).execute({});
        }}
      />
      <label htmlFor={id}>{props.children}</label>
    </>
  );
};

type Props = {
  action: keyof ActionMap;
  children: React.ReactNode;
};
