import { KeyMap } from '../../base-ui/keyMap.ts';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import { ContextMenuTarget } from '../../react-canvas-editor/EditableCanvas.tsx';

export const EdgeContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem
        action={'WAYPOINT_ADD'}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        context={{ point: props.target.pos, id: (props.target as any)['id'] }}
        {...props}
      >
        Add waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_DELETE'}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        context={{ point: props.target.pos, id: (props.target as any)['id'] }}
        {...props}
      >
        Delete waypoint
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  target: ContextMenuTarget;
};
