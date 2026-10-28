import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbEyeOff, TbPlus } from 'react-icons/tb';
import type { ComponentProps } from 'react';
import { RelationDetailPopover } from './RelationDetailPopover';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import type { useEntityGraphController } from './useEntityGraphController';

type Controller = ReturnType<typeof useEntityGraphController>;

/** The node context menu, relation popover and save-as-diagram dialog shared by the entity graphs. */
export const EntityGraphOverlays = ({
  workspaceId,
  controller,
  allowActions,
  relationPopover,
  onCloseRelationPopover,
  diagramDefaults
}: {
  workspaceId: string;
  controller: Controller;
  /** Enables the context menu and save dialog; the popover is always available. */
  allowActions: boolean;
  relationPopover: { relationId: string; x: number; y: number } | null;
  onCloseRelationPopover: () => void;
  diagramDefaults: Pick<
    ComponentProps<typeof SaveDiagramFromGraphDialog>,
    'defaultName' | 'initialDestination'
  >;
}) => {
  const {
    contextMenu,
    setContextMenu,
    rootEntityIds,
    excludeEntity,
    expandEntity,
    saveDiagramOpen,
    setSaveDiagramOpen,
    pendingDiagramContent
  } = controller;

  return (
    <>
      {allowActions && contextMenu && (
        <ContextMenu.Imperative
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbEyeOff size={13} />}
            disabled={rootEntityIds.has(contextMenu.id)}
            onClick={() => excludeEntity(contextMenu.id)}
          >
            Exclude from graph
          </Menu.Item>
          <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => expandEntity(contextMenu.id)}>
            Expand one level deeper
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      {relationPopover && (
        <RelationDetailPopover
          workspaceId={workspaceId}
          relationId={relationPopover.relationId}
          x={relationPopover.x}
          y={relationPopover.y}
          onClose={onCloseRelationPopover}
        />
      )}

      {allowActions && saveDiagramOpen && pendingDiagramContent && (
        <SaveDiagramFromGraphDialog
          open={saveDiagramOpen}
          onClose={() => setSaveDiagramOpen(false)}
          onCreated={() => setSaveDiagramOpen(false)}
          workspaceId={workspaceId}
          diagramContent={pendingDiagramContent}
          {...diagramDefaults}
        />
      )}
    </>
  );
};
