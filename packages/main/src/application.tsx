import { Application as BaseApplication } from '@diagram-craft/canvas-app/application';
import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { KeyMap } from '@diagram-craft/canvas/keyMap';
import { UIActions } from '@diagram-craft/canvas/context';
import { UserState } from './UserState';
import { Extent } from '@diagram-craft/geometry/extent';
import type { Point } from '@diagram-craft/geometry/point';

export interface ApplicationUIActions extends UIActions {
  showPreview: () => void;
}

export class Application extends BaseApplication<ApplicationUIActions> {
  constructor(userState: UserState) {
    super();
    this.userState = userState;
  }

  ready: boolean = false;
  keyMap: KeyMap = {};
  userState: UserState;
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
  newDocument: (size?: Extent, offset?: Point) => void;
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

export const useDocument = () => {
  const application = useApplication();
  return application.model.activeDocument;
};
