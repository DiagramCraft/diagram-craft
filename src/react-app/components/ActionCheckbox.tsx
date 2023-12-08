import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { ToggleAction } from '../../base-ui/keyMap.ts';
import React, { useId } from 'react';

export const ActionCheckbox = (props: Props) => {
  const id = useId();
  const redraw = useRedraw();

  useEventListener(
    'actionchanged',
    ({ action }) => {
      if (action === props.actionMap[props.action]) redraw();
    },
    props.actionMap[props.action]!
  );

  return (
    <>
      <input
        id={id}
        type={'checkbox'}
        checked={(props.actionMap[props.action] as ToggleAction).state}
        onChange={() => {
          (props.actionMap[props.action] as ToggleAction).execute({});
        }}
      />
      <label htmlFor={id}>{props.children}</label>
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  action: keyof ActionMap;
  children: React.ReactNode;
};
