import { useCallback, useState, type MouseEvent } from 'react';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { Menu } from '@diagram-craft/app-components/Menu';
import type { ReactElement } from 'react';
import type { MenuItem } from './DropdownMenu';

type Position<T> = { x: number; y: number; target: T };

/** Renders a `MenuItem[]` at a screen position; renders nothing when the list is empty. */
export const EntityContextMenuView = ({
  x,
  y,
  items,
  onClose
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) =>
  items.length === 0 ? null : (
    <ContextMenu.Imperative x={x} y={y} onClose={onClose}>
      {items.map(item => (
        <span key={item.id ?? item.label} style={{ display: 'contents' }}>
          {item.separatorBefore && <Menu.Separator />}
          <Menu.Item
            leftSlot={item.icon as ReactElement | undefined}
            type={item.danger ? 'danger' : 'regular'}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </Menu.Item>
        </span>
      ))}
    </ContextMenu.Imperative>
  );

/** Right-click menu rendering the same `MenuItem[]` that backs the "..." dropdowns. */
export const useEntityContextMenu = <T,>(getItems: (target: T) => MenuItem[]) => {
  const [state, setState] = useState<Position<T> | null>(null);

  const onContextMenu = useCallback((e: MouseEvent, target: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, target });
  }, []);

  const items = state ? getItems(state.target) : [];
  const menu = state ? (
    <EntityContextMenuView x={state.x} y={state.y} items={items} onClose={() => setState(null)} />
  ) : null;

  return { onContextMenu, menu };
};
