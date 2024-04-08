import { useEventListener } from './hooks/useEventListener.ts';
import { useRedraw } from './useRedraw.tsx';
import React, { useId } from 'react';
import { useActions } from './context/ActionsContext.ts';
import { ToggleAction } from '../base-ui/action.ts';

export const ActionCheckbox = (props: Props) => {
  const { actionMap } = useActions();
  const id = useId();
  const redraw = useRedraw();

  useEventListener(actionMap[props.action]!, 'actionchanged', ({ action }) => {
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
