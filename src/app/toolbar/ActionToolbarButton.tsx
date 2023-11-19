import { ActionEvents, KeyMap } from '../../canvas/keyMap.ts';
import React, { useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { useEventListener } from '../hooks/useEventListener.ts';

export const ActionToolbarButton = (props: Props) => {
  const [enabled, setEnabled] = useState(false);

  useEventListener(
    props.actionMap[props.action]!,
    'actionchanged',
    ({ action }: ActionEvents['actionchanged']) => {
      setEnabled(action.enabled);
    }
  );

  return (
    <Toolbar.Button
      className="ToolbarButton"
      disabled={!enabled}
      onClick={() => {
        props.actionMap[props.action]!.execute();
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
