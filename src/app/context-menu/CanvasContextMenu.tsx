import { KeyMap } from '../../canvas/keyMap.ts';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'UNDO'} {...props}>
        Undo
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'} {...props}>
        Redo
      </ActionContextMenuItem>
      <ContextMenu.Separator className="ContextMenuSeparator" />
      <ActionContextMenuItem action={'SELECT_ALL'} {...props}>
        Select All
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_NODES'} {...props}>
        Select Nodes
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_EDGES'} {...props}>
        Select Edges
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
