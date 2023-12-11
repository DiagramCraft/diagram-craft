import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';

export const CanvasContextMenu = () => {
  return (
    <>
      <ActionContextMenuItem action={'UNDO'}>Undo</ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'}>Redo</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'SELECT_ALL'}>Select All</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_NODES'}>Select Nodes</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_EDGES'}>Select Edges</ActionContextMenuItem>
    </>
  );
};
