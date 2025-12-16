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
import { useApplication, useDiagram } from '../application';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { ActionMenuItem } from './components/ActionMenuItem';
import { ActionToggleMenuItem } from './components/ActionToggleMenuItem';

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
        <ActionMenuItem action={'LAYER_ADD'}>New layer...</ActionMenuItem>

        <ActionMenuItem action={'LAYER_ADD_REFERENCE'}>New reference layer...</ActionMenuItem>
        <ActionMenuItem action={'LAYER_ADD_RULE'}>New rule layer...</ActionMenuItem>
        <Menu.Item onClick={() => actions['SIDEBAR_STRUCTURE']?.execute()}>
          Show layer panel
        </Menu.Item>
        <ActionToggleMenuItem action={'LAYER_TOGGLE_LOCK'} arg={{ id: diagram.activeLayer.id }}>
          Locked
        </ActionToggleMenuItem>
        <Menu.Separator />
        {layers.map(layer => (
          <Menu.Item
            onClick={() => (diagram.layers.active = layer)}
            key={layer.id}
            leftSlot={diagram.activeLayer === layer ? <TbCheck /> : undefined}
            rightSlot={
              <>
                {layer.isLocked() ? (
                  <span style={{ color: 'var(--error-fg)' }}>
                    <TbLock />
                  </span>
                ) : undefined}
                {diagram.layers.visible.includes(layer) ? <TbEye /> : <TbEyeOff />}
              </>
            }
          >
            {layer.name}
          </Menu.Item>
        ))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
