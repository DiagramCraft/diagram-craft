import { Application as BaseApplication } from '@diagram-craft/canvas-app/application';
import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { KeyMap } from '@diagram-craft/canvas/keyMap';
import { Observable } from '@diagram-craft/canvas/component/component';
import { ToolType } from './tools';

export class Application extends BaseApplication {
  constructor() {
    super();
  }

  actions: Partial<ActionMap> = {};
  keyMap: KeyMap = {};
  tool = new Observable<ToolType>('move');
}

//export const application = new Application(baseApplication);

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
