import { TbAdjustments, TbCheck, TbEye, TbEyeOff, TbLock, TbStack2 } from 'react-icons/tb';
import { useRedraw } from './hooks/useRedraw';
import { useDiagram } from './context/DiagramContext';
import { useEventListener } from './hooks/useEventListener';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useActions } from './context/ActionsContext';
import { useState } from 'react';
import { StringInputDialog, StringInputDialogState } from './components/StringInputDialog';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';

export const LayerIndicator = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const actions = useActions();

  useEventListener(diagram, 'change', redraw);
  const [nameDialog, setNameDialog] = useState<StringInputDialogState | undefined>(undefined);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="cmp-layer-indicator" aria-label="Customise options">
            {diagram.activeLayer.type === 'regular' ? (
              <TbStack2 />
            ) : (
              <div style={{ color: 'var(--blue-11)', display: 'flex', alignItems: 'center' }}>
                <TbAdjustments />
              </div>
            )}

            <span>{diagram.activeLayer.name}</span>
            {diagram.activeLayer.isLocked() && (
              <div className={'cmp-layer-indicator__lock'}>
                <TbLock />
              </div>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
            <ActionDropdownMenuItem
              action={'LAYER_ADD'}
              onBeforeSelect={async () => {
                return new Promise<string | boolean>(resolve => {
                  setNameDialog({
                    open: true,
                    title: 'New layer',
                    description: 'Enter a new name for the layer.',
                    saveButtonLabel: 'Create',
                    name: '',
                    onSave: (v: string) => resolve(v)
                  });
                });
              }}
            >
              New layer...
            </ActionDropdownMenuItem>

            <ActionDropdownMenuItem
              action={'LAYER_ADD_ADJUSTMENT'}
              onBeforeSelect={async () => {
                return new Promise<string | boolean>(resolve => {
                  setNameDialog({
                    open: true,
                    title: 'New adjustment layer',
                    description: 'Enter a new name for the adjustment layer.',
                    saveButtonLabel: 'Create',
                    name: '',
                    onSave: (v: string) => resolve(v)
                  });
                });
              }}
            >
              New adjustment layer...
            </ActionDropdownMenuItem>
            <DropdownMenu.Item
              className="cmp-context-menu__item"
              onSelect={() => {
                actions.actionMap['SIDEBAR_LAYERS']?.execute();
              }}
            >
              Show layer panel
            </DropdownMenu.Item>
            <ToggleActionDropdownMenuItem
              action={'LAYER_TOGGLE_LOCK'}
              context={{ id: diagram.activeLayer.id }}
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
            <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <StringInputDialog
        {...(nameDialog ?? { open: false })}
        onClose={() => setNameDialog(undefined)}
      />
    </>
  );
};
