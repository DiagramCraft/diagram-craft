import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ContextMenuTarget } from '@diagram-craft/canvas/ApplicationTriggers';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_PASTE'} arg={{ point: props.target.pos }}>
        Paste
      </ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem arg={undefined} action={'UNDO'}>
        Undo
      </ActionContextMenuItem>
      <ActionContextMenuItem arg={undefined} action={'REDO'}>
        Redo
      </ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem arg={undefined} action={'SELECT_ALL'}>
        Select All
      </ActionContextMenuItem>
      <ActionContextMenuItem arg={undefined} action={'SELECT_ALL_NODES'}>
        Select Nodes
      </ActionContextMenuItem>
      <ActionContextMenuItem arg={undefined} action={'SELECT_ALL_EDGES'}>
        Select Edges
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
