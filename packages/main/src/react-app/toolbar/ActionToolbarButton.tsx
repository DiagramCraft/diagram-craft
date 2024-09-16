import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { useApplication } from '../../application';

export function ActionToolbarButton<
  K extends keyof ActionMap,
  P = Parameters<ActionMap[K]['execute']>[0]
>(props: Props<K, P>) {
  const application = useApplication();
  const actionMap = application.actions;
  const [enabled, setEnabled] = useState(false);

  const action = actionMap[props.action]!;
  useEventListener(action, 'actionChanged', () => {
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

type Props<K extends keyof ActionMap, P = Parameters<ActionMap[K]['execute']>[0]> = {
  action: K;
  children: React.ReactNode;
} & (P extends undefined ? { arg?: never } : { arg: P });
