import { TbCheck, TbEye, TbEyeOff, TbLock, TbStack2 } from 'react-icons/tb';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useActions } from '../context/ActionsContext.tsx';

export const LayerIndicator = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const actions = useActions();

  useEventListener(diagram, 'change', redraw);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="cmp-layer-indicator" aria-label="Customise options">
          <TbStack2 />

          <span>{diagram.layers.active.name}</span>
          {diagram.layers.active.isLocked() && (
            <div className={'cmp-layer-indicator__lock'}>
              <TbLock />
            </div>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
          <DropdownMenu.Item className="cmp-context-menu__item">New Layer...</DropdownMenu.Item>
          <DropdownMenu.Item
            className="cmp-context-menu__item"
            onSelect={() => {
              actions.actionMap['SIDEBAR_LAYERS']?.execute();
            }}
          >
            Show layer panel
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cmp-context-menu__item"
            onSelect={() => {
              diagram.layers.active.locked = !diagram.layers.active.isLocked();
            }}
          >
            {diagram.layers.active.isLocked() ? 'Unlock' : 'Lock'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          {layers.map(layer => (
            <DropdownMenu.Item
              className="cmp-context-menu__item"
              onSelect={() => {
                diagram.layers.active = layer;
              }}
              key={layer.id}
            >
              {diagram.layers.active === layer && (
                <div className="cmp-context-menu__item-indicator">
                  <TbCheck />
                </div>
              )}
              {layer.name}
              <div
                className={'cmp-context-menu__right-slot'}
                style={{ color: 'var(--primary-fg)' }}
              >
                {layer.isLocked() && (
                  <span style={{ color: 'var(--error-fg)' }}>
                    <TbLock />
                  </span>
                )}
                {diagram.layers.visible.includes(layer) ? <TbEye /> : <TbEyeOff />}
              </div>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
