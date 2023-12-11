import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { ToggleAction } from '../../base-ui/keyMap.ts';
import React, { useId } from 'react';
import { useActions } from '../context/ActionsContext.tsx';

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
        checked={(actionMap[props.action] as ToggleAction).state}
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
