import { ActionEvents, KeyMap } from '../../base-ui/keyMap.ts';
import React, { useEffect, useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { useEventListener } from '../hooks/useEventListener.ts';

export const ActionToolbarButton = (props: Props) => {
  const [enabled, setEnabled] = useState(false);

  useEventListener(
    'actionchanged',
    ({ action }: ActionEvents['actionchanged']) => {
      setEnabled(action.enabled);
    },
    props.actionMap[props.action]!
  );

  useEffect(() => {
    const v = props.actionMap[props.action]?.enabled;
    if (v !== enabled) {
      setEnabled(!!v);
    }
  }, [enabled, props.action, props.actionMap]);

  return (
    <Toolbar.Button
      className="cmp-toolbar__button"
      disabled={!enabled}
      onClick={() => {
        props.actionMap[props.action]!.execute({});
      }}
    >
      {props.children}
    </Toolbar.Button>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  action: keyof ActionMap;
  children: React.ReactNode;
};
