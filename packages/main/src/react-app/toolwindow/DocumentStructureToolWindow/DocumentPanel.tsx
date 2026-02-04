import { Tree } from '@diagram-craft/app-components/Tree';
import { Diagram } from '@diagram-craft/model/diagram';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { defaultAppActions } from '../../appActionMap';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { ActionMenuItem } from '../../components/ActionMenuItem';
import { type ReactElement } from 'react';
import { useDraggable, useDropTarget } from '../../hooks/dragAndDropHooks';
import { mustExist } from '@diagram-craft/utils/assert';
import { DiagramReorderUndoableAction } from '@diagram-craft/model/diagramUndoActions';

type Relation = 'before' | 'after';

const MIME_TYPE = 'application/x-diagram-craft-diagram-instances';

export const useDiagramReorderDnD = <E extends HTMLElement>(node: Diagram) => {
  const application = useApplication();
  const document = useDocument();

  const drag = useDraggable<E>(node.id, MIME_TYPE);

  const dropTarget = useDropTarget<E, typeof MIME_TYPE>(
    [MIME_TYPE],
    ev => {
      const droppedId = mustExist(ev[MIME_TYPE]?.before ?? ev[MIME_TYPE]?.after ?? '');
      const diagramToMove = mustExist(document.byId(droppedId));

      // Validate same parent level (covers root and non-root)
      if (diagramToMove.parent !== node.parent) return;

      const relation: Relation = ev[MIME_TYPE]?.before ? 'before' : 'after';

      application.model.activeDiagram.undoManager.addAndExecute(
        new DiagramReorderUndoableAction(document, diagramToMove, node, relation)
      );
    },
    { split: () => [0.5, 0, 0.5] }
  );

  return { eventHandlers: { ...drag.eventHandlers, ...dropTarget.eventHandlers } };
};

const DocumentsContextMenu = (props: DocumentsContextMenuProps) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger element={props.element} />
      <ContextMenu.Menu>
        <ActionMenuItem action={'DIAGRAM_RENAME'} arg={{ diagramId: props.diagramId }} />
        <ActionMenuItem action={'DIAGRAM_ADD'} arg={{}}>
          Add
        </ActionMenuItem>
        <ActionMenuItem action={'DIAGRAM_ADD'} arg={{ parentId: props.diagramId }}>
          Add subpage
        </ActionMenuItem>
        <ActionMenuItem action={'DIAGRAM_REMOVE'} arg={{ diagramId: props.diagramId }} />
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

type DocumentsContextMenuProps = {
  diagramId: string;
  element: ReactElement;
};

const DiagramLabel = (props: { diagram: Diagram; onValueChange: (v: string) => void }) => {
  return (
    <div className={'util-action'} onClick={() => props.onValueChange(props.diagram.id)}>
      {props.diagram.name}
    </div>
  );
};

const DiagramTreeNodeItem = (props: {
  node: Diagram;
  value: string;
  onValueChange: (v: string) => void;
}) => {
  const dnd = useDiagramReorderDnD(props.node);

  return (
    <Tree.Node key={props.node.id} isOpen={true} {...dnd.eventHandlers}>
      <DocumentsContextMenu
        diagramId={props.node.id}
        element={
          <Tree.NodeLabel>
            <DiagramLabel diagram={props.node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
        }
      />
      <Tree.NodeCell>{props.value === props.node.id ? 'Active' : ''}</Tree.NodeCell>
      {props.node.diagrams.length > 0 && (
        <Tree.Children>
          {props.node.diagrams.map(child => (
            <DiagramTreeNodeItem
              key={child.id}
              node={child}
              value={props.value}
              onValueChange={props.onValueChange}
            />
          ))}
        </Tree.Children>
      )}
    </Tree.Node>
  );
};

const RootDiagramNode = (props: {
  node: Diagram;
  activeDiagramId: string;
  onValueChange: (v: string) => void;
}) => {
  const dnd = useDiagramReorderDnD(props.node);

  return (
    <Tree.Node
      key={props.node.id}
      isOpen={true}
      data-state={props.activeDiagramId === props.node.id ? 'on' : 'off'}
      {...dnd.eventHandlers}
    >
      <DocumentsContextMenu
        diagramId={props.node.id}
        element={
          <Tree.NodeLabel>
            <DiagramLabel diagram={props.node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
        }
      />
      <Tree.NodeCell>{props.activeDiagramId === props.node.id ? 'Active' : ''}</Tree.NodeCell>
      {props.node.diagrams.length > 0 && (
        <Tree.Children>
          {props.node.diagrams.map(child => (
            <DiagramTreeNodeItem
              key={child.id}
              node={child}
              value={props.activeDiagramId}
              onValueChange={props.onValueChange}
            />
          ))}
        </Tree.Children>
      )}
    </Tree.Node>
  );
};

export const DocumentPanel = () => {
  const diagram = useDiagram();
  const document = useDocument();
  const application = useApplication();
  const redraw = useRedraw();
  useEventListener(document, 'diagramChanged', redraw);
  useEventListener(document, 'diagramAdded', redraw);
  useEventListener(document, 'diagramRemoved', redraw);

  const onValueChange = (v: string) => {
    application.model.activeDiagram = application.model.activeDocument.byId(v)!;
    application.actions = makeActionMap(defaultAppActions)(application);
  };

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'document'}
      title={'Document'}
      style={{ padding: '0.25rem 0' }}
    >
      <div className="cmp-document-list">
        <Tree.Root>
          {document.diagrams.map(node => (
            <RootDiagramNode
              key={node.id}
              node={node}
              activeDiagramId={diagram.id}
              onValueChange={onValueChange}
            />
          ))}
        </Tree.Root>
      </div>
    </ToolWindowPanel>
  );
};
