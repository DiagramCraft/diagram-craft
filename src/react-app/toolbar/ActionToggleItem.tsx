import * as ReactToolbar from '@radix-ui/react-toolbar';
import React, { useContext, useEffect } from 'react';
import { ActionToggleGroupContext } from './ActionToggleGroup.tsx';
import { ToggleAction } from '../../base-ui/keyMap.ts';
import { useEventListener } from '../hooks/useEventListener.ts';

export const ActionToggleItem = (props: Props) => {
  const actions = useContext(ActionToggleGroupContext);

  useEffect(() => {
    actions!.setActionState(props.action, (props.actionMap[props.action] as ToggleAction)?.state);
  }, [props.action, props.actionMap, actions]);

  useEventListener(
    'actionchanged',
    ({ action }) => {
      actions!.setActionState(props.action, (action as ToggleAction)?.state);
    },
    props.actionMap[props.action]!
  );

  return (
    <ReactToolbar.ToggleItem
      className="cmp-toolbar__toggle-item"
      value={props.action}
      aria-label={props.action}
    >
      {props.children}
    </ReactToolbar.ToggleItem>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  action: keyof ActionMap;
  children: React.ReactNode;
};
