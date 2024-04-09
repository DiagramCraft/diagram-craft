import React, { useEffect, useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useActions } from '../context/ActionsContext.ts';
import { ActionEvents } from '../../canvas/action.ts';

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
