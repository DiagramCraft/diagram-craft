import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { type Action, ToggleAction } from '@diagram-craft/canvas/action';
import { ActionName } from '@diagram-craft/canvas/keyMap';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useApplication } from '../../application';

const getActionValue = (action: Action<unknown>) =>
  (action as ToggleAction).getState({}) ? 'on' : 'off';

export const ActionToggleButton = (props: Props) => {
  const application = useApplication();
  const actionMap = application.actions;

  useEventListener(actionMap[props.action]!, 'actionChanged', () => {
    setValue(getActionValue(actionMap[props.action]!));
  });

  const [value, setValue] = useState<'on' | 'off'>(getActionValue(actionMap[props.action]!));

  useEffect(() => {
    const actionState = getActionValue(actionMap[props.action]!);
    if (actionState !== value) {
      actionMap[props.action]!.execute({});
      setValue(getActionValue(actionMap[props.action]!));
    }
  }, [value, actionMap[props.action], props.action]);

  return (
    <Toolbar.ToggleGroup type={'single'} value={value} onChange={v => setValue(v as 'on' | 'off')}>
      <Toolbar.ToggleItem
        value={'on'}
        aria-label={props.action}
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
