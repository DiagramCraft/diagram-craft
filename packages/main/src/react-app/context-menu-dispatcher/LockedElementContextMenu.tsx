import { ActionMenuItem } from '../components/ActionMenuItem';
import type { ContextMenuTarget } from '@diagram-craft/canvas/context';

export const LockedElementContextMenu = (props: {
  target: ContextMenuTarget<'locked-element'>;
}) => {
  return <ActionMenuItem action={'ELEMENT_UNLOCK'} arg={{ elementId: props.target.elementId }} />;
};
