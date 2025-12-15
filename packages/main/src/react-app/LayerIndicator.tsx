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
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { useApplication, useDiagram } from '../application';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

export const LayerIndicator = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const application = useApplication();
  const actions = application.actions;

  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.layers, 'layerStructureChange', redraw);

  return (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <button type={'button'} className="cmp-layer-indicator">
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
        }
      />

      <MenuButton.Menu>
        <ActionDropdownMenuItem action={'LAYER_ADD'}>New layer...</ActionDropdownMenuItem>

        <ActionDropdownMenuItem action={'LAYER_ADD_REFERENCE'}>
          New reference layer...
        </ActionDropdownMenuItem>
        <ActionDropdownMenuItem action={'LAYER_ADD_RULE'}>New rule layer...</ActionDropdownMenuItem>
        <Menu.Item onClick={() => actions['SIDEBAR_LAYERS']?.execute()}>Show layer panel</Menu.Item>
        <ToggleActionDropdownMenuItem
          action={'LAYER_TOGGLE_LOCK'}
          arg={{ id: diagram.activeLayer.id }}
        >
          Locked
        </ToggleActionDropdownMenuItem>
        <Menu.Separator />
        {layers.map(layer => (
          <Menu.Item onClick={() => (diagram.layers.active = layer)} key={layer.id}>
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
          </Menu.Item>
        ))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
