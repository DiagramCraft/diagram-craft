import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { Actions } from '@diagram-craft/canvas/keyMap';
import { ApplicationTriggers } from '@diagram-craft/canvas/ApplicationTriggers';

export const ActionsContext = React.createContext<
  { actions: Actions; applicationTriggers: ApplicationTriggers } | undefined
>(undefined);

export const useActions = () => {
  const actions = React.useContext(ActionsContext);
  assert.present(actions);
  return actions.actions;
};

export const useApplicationTriggers = () => {
  const actions = React.useContext(ActionsContext);
  assert.present(actions);
  return actions.applicationTriggers;
};
