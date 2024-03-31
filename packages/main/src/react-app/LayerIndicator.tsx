import { TbAdjustments, TbCheck, TbEye, TbEyeOff, TbLock, TbStack2 } from 'react-icons/tb';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { useDiagram } from './context/DiagramContext.ts';
import { useEventListener } from './hooks/useEventListener.ts';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useActions } from './context/ActionsContext.ts';
import { useState } from 'react';
import { StringInputDialog, StringInputDialogState } from './components/StringInputDialog.tsx';
import { ActionDropdownMenuItem } from './dropdown/ActionDropdownMenuItem.tsx';
import { ToggleActionDropdownMenuItem } from './dropdown/ToggleActionDropdownMenuItem.tsx';

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
            {diagram.layers.active.type === 'layer' ? (
              <TbStack2 />
            ) : (
              <div style={{ color: 'var(--blue-11)', display: 'flex', alignItems: 'center' }}>
                <TbAdjustments />
              </div>
            )}

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
            <ActionDropdownMenuItem
              action={'LAYER_ADD'}
              onBeforeSelect={async () => {
                return new Promise<string | boolean>(resolve => {
                  setNameDialog({
                    isOpen: true,
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
                    isOpen: true,
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
              context={{ id: diagram.layers.active.id }}
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
            <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <StringInputDialog
        {...(nameDialog ?? { isOpen: false })}
        onClose={() => setNameDialog(undefined)}
      />
    </>
  );
};
