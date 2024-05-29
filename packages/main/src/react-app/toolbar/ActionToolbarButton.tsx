import React, { useEffect, useState } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { useEventListener } from '../hooks/useEventListener';
import { useActions } from '../context/ActionsContext';
import { ActionEvents } from '@diagram-craft/canvas/action';
import * as Tooltip from '@radix-ui/react-tooltip';

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
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Toolbar.Button
            className="cmp-toolbar__button"
            disabled={!enabled}
            onClick={() => {
              actionMap[props.action]!.execute({});
            }}
          >
            {props.children}
          </Toolbar.Button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="cmp-tooltip" sideOffset={5} side={'bottom'}>
            {props.action}
            <Tooltip.Arrow className="cmp-tooltip__arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

type Props = {
  action: keyof ActionMap;
  children: React.ReactNode;
};
