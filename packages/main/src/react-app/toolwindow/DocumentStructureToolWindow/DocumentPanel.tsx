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
import { DiagramReorderUndoableAction } from '@diagram-craft/model/diagramUndoActions';

const DIAGRAM_INSTANCES = 'application/x-diagram-craft-diagram-instances';

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
    <div
      className={'util-action'}
      onClick={() => {
        props.onValueChange(props.diagram.id);
      }}
    >
      {props.diagram.name}
    </div>
  );
};

const DiagramTreeNodeItem = (props: {
  node: Diagram;
  value: string;
  onValueChange: (v: string) => void;
}) => {
  const application = useApplication();
  const document = useDocument();
  const { node } = props;

  const drag = useDraggable(node.id, DIAGRAM_INSTANCES);
  const dropTarget = useDropTarget(
    [DIAGRAM_INSTANCES],
    ev => {
      const droppedId = (ev[DIAGRAM_INSTANCES]?.before ?? ev[DIAGRAM_INSTANCES]?.after) ?? '';
      if (!droppedId) return;

      const diagramToMove = document.byId(droppedId);
      if (!diagramToMove) return;

      // Validate same parent level
      if (diagramToMove.parent !== node.parent) {
        console.warn('Cannot reorder diagrams across different parent levels');
        return;
      }

      // Diagrams are a sequence: 'before' zone → insert before, 'after' zone → insert after
      const relation = ev[DIAGRAM_INSTANCES]?.before ? 'before' : 'after';

      const undoManager = application.model.activeDiagram.undoManager;
      const action = new DiagramReorderUndoableAction(document, diagramToMove, node, relation);
      undoManager.addAndExecute(action);
    },
    { split: () => [0.5, 0, 0.5] }
  );

  return (
    <Tree.Node key={node.id} isOpen={true} {...drag.eventHandlers} {...dropTarget.eventHandlers}>
      <DocumentsContextMenu
        diagramId={node.id}
        element={
          <Tree.NodeLabel>
            <DiagramLabel diagram={node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
        }
      />
      <Tree.NodeCell>{props.value === node.id ? 'Active' : ''}</Tree.NodeCell>
      {node.diagrams.length > 0 && (
        <Tree.Children>
          <DiagramTreeNode diagram={node} onValueChange={props.onValueChange} value={props.value} />
        </Tree.Children>
      )}
    </Tree.Node>
  );
};

const DiagramTreeNode = (props: {
  diagram: Diagram;
  value: string;
  onValueChange: (v: string) => void;
}) => {
  return (
    <>
      {props.diagram.diagrams.map(node => (
        <DiagramTreeNodeItem
          key={node.id}
          node={node}
          value={props.value}
          onValueChange={props.onValueChange}
        />
      ))}
    </>
  );
};

const RootDiagramNode = (props: {
  node: Diagram;
  activeDiagramId: string;
  onValueChange: (v: string) => void;
}) => {
  const application = useApplication();
  const document = useDocument();
  const { node } = props;

  const drag = useDraggable(node.id, DIAGRAM_INSTANCES);
  const dropTarget = useDropTarget(
    [DIAGRAM_INSTANCES],
    ev => {
      const droppedId = (ev[DIAGRAM_INSTANCES]?.before ?? ev[DIAGRAM_INSTANCES]?.after) ?? '';
      if (!droppedId) return;

      const diagramToMove = document.byId(droppedId);
      if (!diagramToMove) return;

      // Validate same parent level (root diagrams have parent === undefined)
      if (diagramToMove.parent !== node.parent) {
        console.warn('Cannot reorder diagrams across different parent levels');
        return;
      }

      // Diagrams are a sequence: 'before' zone → insert before, 'after' zone → insert after
      const relation = ev[DIAGRAM_INSTANCES]?.before ? 'before' : 'after';

      const undoManager = application.model.activeDiagram.undoManager;
      const action = new DiagramReorderUndoableAction(document, diagramToMove, node, relation);
      undoManager.addAndExecute(action);
    },
    { split: () => [0.5, 0, 0.5] }
  );

  return (
    <Tree.Node
      key={node.id}
      isOpen={true}
      data-state={props.activeDiagramId === node.id ? 'on' : 'off'}
      {...drag.eventHandlers}
      {...dropTarget.eventHandlers}
    >
      <DocumentsContextMenu
        diagramId={node.id}
        element={
          <Tree.NodeLabel>
            <DiagramLabel diagram={node} onValueChange={props.onValueChange} />
          </Tree.NodeLabel>
        }
      />
      <Tree.NodeCell>{props.activeDiagramId === node.id ? 'Active' : ''}</Tree.NodeCell>
      {node.diagrams.length > 0 && (
        <Tree.Children>
          <DiagramTreeNode
            diagram={node}
            onValueChange={props.onValueChange}
            value={props.activeDiagramId}
          />
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
