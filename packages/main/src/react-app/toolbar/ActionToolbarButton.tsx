import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useActions } from '../context/ActionsContext';
import { ActionEvents } from '@diagram-craft/canvas/action';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';

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
