import { DragDopManager } from '../base-ui/drag/dragDropManager.ts';

const INSTANCE = new DragDopManager();

// TODO: Do we really need a hook for this?
export const useDragDrop = () => {
  return INSTANCE;
};
