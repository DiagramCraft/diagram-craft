import { ActionEvents } from '../../base-ui/keyMap.ts';
import React, { useEffect, useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useActions } from '../context/ActionsContext.tsx';

export const ActionToolbarButton = (props: Props) => {
  const { actionMap } = useActions();
  const [enabled, setEnabled] = useState(false);

  useEventListener(
    actionMap[props.action]!,
    'actionchanged',
    ({ action }: ActionEvents['actionchanged']) => {
      setEnabled(action.enabled);
    }
  );

  useEffect(() => {
    const v = actionMap[props.action]?.enabled;
    if (v !== enabled) {
      setEnabled(!!v);
    }
  }, [enabled, props.action, actionMap]);

  return (
    <Toolbar.Button
      className="cmp-toolbar__button"
      disabled={!enabled}
      onClick={() => {
        actionMap[props.action]!.execute({});
      }}
    >
      {props.children}
    </Toolbar.Button>
  );
};

type Props = {
  action: keyof ActionMap;
  children: React.ReactNode;
};
