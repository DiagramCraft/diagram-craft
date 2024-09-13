import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useActions } from '../context/ActionsContext';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';

export function ActionToolbarButton<K extends keyof ActionMap>(props: Props<K>) {
  const { actionMap } = useActions();
  const [enabled, setEnabled] = useState(false);

  const action = actionMap[props.action]!;
  useEventListener(action, 'actionchanged', () => {
    setEnabled(action.isEnabled({}));
  });

  useEffect(() => {
    const v = action.isEnabled({});
    if (v !== enabled) {
      setEnabled(!!v);
    }
  }, [enabled, action]);

  return (
    <Tooltip message={props.action as string}>
      <Toolbar.Button
        disabled={!enabled}
        onClick={() => {
          actionMap[props.action]!.execute(props.arg ?? {});
        }}
      >
        {props.children}
      </Toolbar.Button>
    </Tooltip>
  );
}

type Props<K extends keyof ActionMap> = {
  action: K;
  arg: Parameters<ActionMap[K]['execute']>[0];
  children: React.ReactNode;
};
