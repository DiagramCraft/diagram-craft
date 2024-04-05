import React from 'react';
import { assert } from '../../utils/assert.ts';
import { KeyMap } from '../../base-ui/keyMap.ts';

export type ActionsContextType = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};

export const ActionsContext = React.createContext<ActionsContextType | undefined>(undefined);

export const useActions = () => {
  const actions = React.useContext(ActionsContext);
  assert.present(actions);
  return actions;
};
