import type { KeyboardEvent, MouseEvent } from 'react';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import { getMapEntityId } from './mapViewTraversal';

export type MapBoxHandlers = {
  role: 'button';
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export const getMapBoxHandlers = (
  node: TreeNode,
  onEntityClick: (entityId: string) => void
): MapBoxHandlers => ({
  role: 'button',
  tabIndex: 0,
  onClick: () => onEntityClick(getMapEntityId(node)),
  onKeyDown: event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEntityClick(getMapEntityId(node));
    }
  }
});

export const getMapDetailClick =
  (publicId: string, onEntityClick: (entityId: string) => void) =>
  (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onEntityClick(publicId);
  };
