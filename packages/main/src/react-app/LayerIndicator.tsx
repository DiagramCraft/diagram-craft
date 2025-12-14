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
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';

export const LayerIndicator = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const application = useApplication();
  const actions = application.actions;

  useEventListener(diagram, 'diagramChange', redraw);
  useEventListener(diagram.layers, 'layerStructureChange', redraw);

  return (
    <BaseUIMenu.Root>
      <BaseUIMenu.Trigger className="cmp-layer-indicator" type="button">
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
      </BaseUIMenu.Trigger>

      <BaseUIMenu.Portal>
        <BaseUIMenu.Positioner sideOffset={5}>
          <BaseUIMenu.Popup className="cmp-context-menu">
            <ActionDropdownMenuItem action={'LAYER_ADD'}>New layer...</ActionDropdownMenuItem>

            <ActionDropdownMenuItem action={'LAYER_ADD_REFERENCE'}>
              New reference layer...
            </ActionDropdownMenuItem>
            <ActionDropdownMenuItem action={'LAYER_ADD_RULE'}>
              New rule layer...
            </ActionDropdownMenuItem>
            <BaseUIMenu.Item
              className="cmp-context-menu__item"
              onSelect={() => {
                actions['SIDEBAR_LAYERS']?.execute();
              }}
            >
              Show layer panel
            </BaseUIMenu.Item>
            <ToggleActionDropdownMenuItem
              action={'LAYER_TOGGLE_LOCK'}
              arg={{ id: diagram.activeLayer.id }}
            >
              Locked
            </ToggleActionDropdownMenuItem>
            <BaseUIMenu.Separator className="cmp-context-menu__separator" />
            {layers.map(layer => (
              <BaseUIMenu.Item
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
                <div
                  className={'cmp-context-menu__right-slot'}
                  style={{ color: 'var(--panel-fg)' }}
                >
                  {layer.isLocked() && (
                    <span style={{ color: 'var(--error-fg)' }}>
                      <TbLock />
                    </span>
                  )}
                  {diagram.layers.visible.includes(layer) ? <TbEye /> : <TbEyeOff />}
                </div>
              </BaseUIMenu.Item>
            ))}
            <BaseUIMenu.Arrow className="cmp-context-menu__arrow" />
          </BaseUIMenu.Popup>
        </BaseUIMenu.Positioner>
      </BaseUIMenu.Portal>
    </BaseUIMenu.Root>
  );
};
