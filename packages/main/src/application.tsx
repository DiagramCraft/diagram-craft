import { Application as BaseApplication } from '@diagram-craft/canvas-app/application';
import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { KeyMap } from '@diagram-craft/canvas/keyMap';

export class Application extends BaseApplication {
  constructor() {
    super();
  }

  ready: boolean = false;
  keyMap: KeyMap = {};
  #file: FileActions | undefined;

  set file(file: FileActions) {
    this.#file = file;
  }

  get file() {
    return this.#file!;
  }
}

interface FileActions {
  loadDocument: (url: string) => void;
  newDocument: () => void;
  clearDirty: () => void;
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
