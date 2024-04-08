import React from 'react';
import { assert } from '../../utils/assert.ts';
import { Actions } from '../../base-ui/keyMap.ts';

export const ActionsContext = React.createContext<Actions | undefined>(undefined);

export const useActions = () => {
  const actions = React.useContext(ActionsContext);
  assert.present(actions);
  return actions;
};
