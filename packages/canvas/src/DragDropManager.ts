import { DragDopManager } from './drag/dragDropManager.ts';

export const DRAG_DROP_MANAGER = new DragDopManager();

// TODO: Do we really need a hook for this?
export const useDragDrop = () => {
  return DRAG_DROP_MANAGER;
};
