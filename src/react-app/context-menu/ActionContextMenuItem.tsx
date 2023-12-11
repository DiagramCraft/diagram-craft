import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContext, findKeyBindings } from '../../base-ui/keyMap.ts';
import React from 'react';
import { useActions } from '../context/ActionsContext.tsx';

// TODO: Maybe attach listener to action and re-render when it changes?
export const ActionContextMenuItem = (props: Props) => {
  const { actionMap, keyMap } = useActions();
  return (
    <ContextMenu.Item
      className="cmp-context-menu__item"
      disabled={!actionMap[props.action]?.enabled}
      onSelect={() => {
        actionMap[props.action]!.execute(props.context ?? {});
      }}
    >
      {props.children}{' '}
      <div className="cmp-context-menu__right-slot">{findKeyBindings(props.action, keyMap)}</div>
    </ContextMenu.Item>
  );
};

type Props = {
  action: keyof ActionMap;
  context?: ActionContext;
  children: React.ReactNode;
};
