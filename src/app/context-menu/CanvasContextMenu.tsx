import { KeyMap } from '../../canvas/keyMap.ts';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'UNDO'} {...props}>
        Undo
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'} {...props}>
        Redo
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
