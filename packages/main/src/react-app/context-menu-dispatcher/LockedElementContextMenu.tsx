import { ActionMenuItem } from '../components/ActionMenuItem';
import type { ContextMenuTarget } from '@diagram-craft/canvas/context';

export const LockedElementContextMenu = (props: { target: ContextMenuTarget<'lockedElement'> }) => {
  return (
    <ActionMenuItem action={'ELEMENT_TOGGLE_LOCK'} arg={{ elementId: props.target.elementId }}>
      Unlock Element
    </ActionMenuItem>
  );
};
