import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React, { useState } from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { MessageDialog, MessageDialogState } from '../../components/MessageDialog';
import { StringInputDialog, StringInputDialogState } from '../../components/StringInputDialog';
import { Layer } from '@diagram-craft/model/diagramLayer';

export const LayerContextMenu = (props: Props) => {
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<MessageDialogState>(
    MessageDialog.INITIAL_STATE
  );
  const [nameDialog, setNameDialog] = useState<StringInputDialogState | undefined>(undefined);

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="cmp-context-menu">
            <ActionContextMenuItem
              action={'LAYER_RENAME'}
              context={{ id: props.layer?.id }}
              onBeforeSelect={async () => {
                return new Promise<string | boolean>(resolve => {
                  setNameDialog({
                    isOpen: true,
                    title: 'Rename layer',
                    description: 'Enter a new name for the layer.',
                    saveButtonLabel: 'Rename',
                    name: props.layer?.name ?? '',
                    onSave: (v: string) => resolve(v)
                  });
                });
              }}
            >
              Rename...
            </ActionContextMenuItem>
            <ToggleActionContextMenuItem
              action={'LAYER_TOGGLE_VISIBILITY'}
              context={{ id: props.layer?.id }}
            >
              Visible
            </ToggleActionContextMenuItem>
            <ToggleActionContextMenuItem
              action={'LAYER_TOGGLE_LOCK'}
              context={{ id: props.layer?.id }}
            >
              Locked
            </ToggleActionContextMenuItem>
            <ActionContextMenuItem
              action={'LAYER_DELETE_LAYER'}
              context={{ id: props.layer?.id }}
              onBeforeSelect={async () => {
                return new Promise<boolean>(resolve => {
                  setConfirmDeleteDialog({
                    isOpen: true,
                    title: 'Delete layer',
                    message: 'Are you sure you want to delete this layer?',
                    buttons: [
                      {
                        label: 'Cancel',
                        type: 'cancel',
                        onClick: () => resolve(false)
                      },
                      {
                        label: 'Delete',
                        type: 'danger',
                        onClick: () => resolve(true)
                      }
                    ]
                  });
                });
              }}
            >
              Delete
            </ActionContextMenuItem>
            <ContextMenu.Separator className="cmp-context-menu__separator" />
            <ActionContextMenuItem
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
            </ActionContextMenuItem>

            <ActionContextMenuItem
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
            </ActionContextMenuItem>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <MessageDialog
        {...confirmDeleteDialog}
        onClose={() => setConfirmDeleteDialog(MessageDialog.INITIAL_STATE)}
      />

      <StringInputDialog
        {...(nameDialog ?? { isOpen: false })}
        onClose={() => setNameDialog(undefined)}
      />
    </>
  );
};

type Props = {
  layer?: Layer | undefined;
  children: React.ReactNode;
};
