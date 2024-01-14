import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ToggleAction } from '../../base-ui/keyMap.ts';
import React, { useState } from 'react';
import { useActions } from '../context/ActionsContext.tsx';

type ActionToggleGroupContextType = {
  setActionState(action: keyof ActionMap, state: boolean): void;
};

export const ActionToggleGroupContext = React.createContext<
  ActionToggleGroupContextType | undefined
>(undefined);

export const ActionToggleGroup = (props: Props) => {
  const { actionMap } = useActions();
  const [values, setValues] = useState<Record<string, boolean>>({});

  return (
    <ActionToggleGroupContext.Provider
      value={{
        setActionState(action: keyof ActionMap, state: boolean) {
          if (state) {
            if (!values[action]) {
              setValues({ ...values, [action]: true });
            }
          } else {
            if (values[action]) {
              setValues({ ...values, [action]: false });
            }
          }
        }
      }}
    >
      <ReactToolbar.ToggleGroup
        type={'multiple'}
        value={Object.entries(values)
          .filter(([, k]) => k)
          .map(([v]) => v)}
        onValueChange={value => {
          for (const action of Object.keys(values)) {
            if (value.includes(action) && !values[action]) {
              (actionMap[action as keyof ActionMap] as ToggleAction).execute({});
            } else if (!value.includes(action) && values[action]) {
              (actionMap[action as keyof ActionMap] as ToggleAction).execute({});
            }
          }
        }}
      >
        {props.children}
      </ReactToolbar.ToggleGroup>
    </ActionToggleGroupContext.Provider>
  );
};

type Props = {
  children: React.ReactNode;
};
