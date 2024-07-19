import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useActions } from '../context/ActionsContext';
import { ActionEvents } from '@diagram-craft/canvas/action';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';

export const ActionToolbarButton = (props: Props) => {
  const { actionMap } = useActions();
  const [enabled, setEnabled] = useState(false);

  useEventListener(
    actionMap[props.action]!,
    'actionchanged',
    ({ action }: ActionEvents['actionchanged']) => {
      setEnabled(action.isEnabled({}));
    }
  );

  useEffect(() => {
    const v = actionMap[props.action]?.isEnabled({});
    if (v !== enabled) {
      setEnabled(!!v);
    }
  }, [enabled, props.action, actionMap]);

  return (
    <Tooltip message={props.action as string}>
      <Toolbar.Button
        disabled={!enabled}
        onClick={() => {
          actionMap[props.action]!.execute({});
        }}
      >
        {props.children}
      </Toolbar.Button>
    </Tooltip>
  );
};

type Props = {
  action: keyof ActionMap;
  children: React.ReactNode;
};
