import {
  TbAdjustments,
  TbCheck,
  TbEye,
  TbEyeOff,
  TbLayersSelectedBottom,
  TbLink,
  TbLock,
  TbStack2
} from 'react-icons/tb';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { useApplication, useDiagram } from '../application';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';

export const LayerIndicator = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const application = useApplication();
  const actions = application.actions;

  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.layers, 'layerStructureChange', redraw);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="cmp-layer-indicator" type="button">
          {diagram.activeLayer.type === 'regular' ? (
            <TbStack2 />
          ) : diagram.activeLayer.type === 'reference' ? (
            <div style={{ color: 'var(--accent-fg)', display: 'flex', alignItems: 'center' }}>
              <TbLink />
            </div>
          ) : diagram.activeLayer.type === 'modification' ? (
            <div style={{ color: 'var(--accent-fg)', display: 'flex', alignItems: 'center' }}>
              <TbLayersSelectedBottom />
            </div>
          ) : (
            <div style={{ color: 'var(--accent-fg)', display: 'flex', alignItems: 'center' }}>
              <TbAdjustments />
            </div>
          )}

          <Tooltip
            message={`Layer: ${diagram.activeLayer.name}`}
            element={<span>{diagram.activeLayer.name}</span>}
          />

          {diagram.activeLayer.isLocked() && (
            <div className={'cmp-layer-indicator__lock'}>
              <TbLock />
            </div>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
          <ActionDropdownMenuItem action={'LAYER_ADD'}>New layer...</ActionDropdownMenuItem>

          <ActionDropdownMenuItem action={'LAYER_ADD_REFERENCE'}>
            New reference layer...
          </ActionDropdownMenuItem>
          <ActionDropdownMenuItem action={'LAYER_ADD_RULE'}>
            New rule layer...
          </ActionDropdownMenuItem>
          <DropdownMenu.Item
            className="cmp-context-menu__item"
            onSelect={() => {
              actions['SIDEBAR_LAYERS']?.execute();
            }}
          >
            Show layer panel
          </DropdownMenu.Item>
          <ToggleActionDropdownMenuItem
            action={'LAYER_TOGGLE_LOCK'}
            arg={{ id: diagram.activeLayer.id }}
          >
            Locked
          </ToggleActionDropdownMenuItem>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          {layers.map(layer => (
            <DropdownMenu.Item
              className="cmp-context-menu__item"
              onSelect={() => {
                diagram.layers.active = layer;
              }}
              key={layer.id}
            >
              {diagram.activeLayer === layer && (
                <div className="cmp-context-menu__item-indicator">
                  <TbCheck />
                </div>
              )}
              {layer.name}
              <div className={'cmp-context-menu__right-slot'} style={{ color: 'var(--panel-fg)' }}>
                {layer.isLocked() && (
                  <span style={{ color: 'var(--error-fg)' }}>
                    <TbLock />
                  </span>
                )}
                {diagram.layers.visible.includes(layer) ? <TbEye /> : <TbEyeOff />}
              </div>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
