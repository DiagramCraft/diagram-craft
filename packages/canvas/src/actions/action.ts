import type { edgeTextAddActions } from './edgeTextAddAction';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof edgeTextAddActions> {}
  }
}

export interface ActionMap extends DiagramCraft.ActionMapExtensions {}
