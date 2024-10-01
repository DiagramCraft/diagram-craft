import { Application as BaseApplication } from '@diagram-craft/canvas-app/application';
import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { KeyMap } from '@diagram-craft/canvas/keyMap';
import { UIActions } from '@diagram-craft/canvas/context';

export interface ApplicationUIActions extends UIActions {
  loadDocument: (url: string) => void;
  newDocument: () => void;
  clearDirty: () => void;
}

export class Application extends BaseApplication<ApplicationUIActions> {
  constructor() {
    super();
  }

  ready: boolean = false;
  keyMap: KeyMap = {};
}

export const ApplicationContext = React.createContext<{ application: Application } | undefined>(
  undefined
);

export const useApplication = () => {
  const context = React.useContext(ApplicationContext);
  assert.present(context);
  return context.application;
};

export const useDiagram = () => {
  const application = useApplication();
  return application.model.activeDiagram;
};
