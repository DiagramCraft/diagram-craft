import { EntityContextMenuView } from '../../../components/EntityContextMenu';
import { buildEntityMenuItems, type EntityRef } from './entityMenu';
import { useEntityCommonActions } from './useEntityCommonActions';
import { TbEyeOff, TbPlus } from 'react-icons/tb';
import type { ComponentProps } from 'react';
import { RelationDetailPopover } from './RelationDetailPopover';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import type { useEntityGraphController } from './useEntityGraphController';

type Controller = ReturnType<typeof useEntityGraphController>;

// Graph nodes carry only the public id, name and schema, which is all the non-pin actions need.
const graphNodeRef = (id: string, controller: Controller): EntityRef => {
  const data = controller.nodes.find(node => node.id === id)?.data;
  return {
    _uid: id,
    _publicId: id,
    _name: data?.entityName ?? id,
    _slug: id,
    _schema: { id: data?.entitySchemaId ?? '' }
  };
};

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
  const commonActions = useEntityCommonActions();
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
        <EntityContextMenuView
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={buildEntityMenuItems(graphNodeRef(contextMenu.id, controller), {
            actions: commonActions,
            pin: false,
            extra: [
              {
                id: 'exclude',
                label: 'Exclude',
                icon: <TbEyeOff size={14} />,
                disabled: rootEntityIds.has(contextMenu.id),
                onClick: () => excludeEntity(contextMenu.id)
              },
              {
                id: 'expand',
                label: 'Expand one level deeper',
                icon: <TbPlus size={14} />,
                onClick: () => expandEntity(contextMenu.id)
              }
            ]
          })}
        />
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
