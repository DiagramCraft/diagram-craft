import * as ReactToolbar from '@radix-ui/react-toolbar';
import React from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';

export const ActionToggleButton = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.actionMap[props.action]!, 'actionchanged', redraw);

  return (
    <ReactToolbar.Button
      className="cmp-toolbar__button"
      data-state={props.actionMap['TOGGLE_RULER']!.state ? 'on' : 'off'}
      value={props.action}
      aria-label={props.action}
      onClick={() => {
        props.actionMap[props.action]!.execute({});
      }}
    >
      {props.children}
    </ReactToolbar.Button>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  action: keyof ActionMap;
  children: React.ReactNode;
};
