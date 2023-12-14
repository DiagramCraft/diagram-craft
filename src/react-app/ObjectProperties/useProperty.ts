import { EditableDiagram, SnapManagerConfigProps } from '../../model-editor/editable-diagram.ts';
import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramEdge } from '../../model-viewer/diagramEdge.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import {
  makePropertyArrayHook,
  makePropertyHook,
  PropertyArrayHook,
  PropertyArrayUndoableAction,
  PropertyHook,
  PropertyUndoableAction
} from './usePropertyFactory.ts';

export const useDiagramProperty: PropertyHook<EditableDiagram, DiagramProps> = makePropertyHook<
  EditableDiagram,
  DiagramProps
>(
  diagram => diagram.props,
  (diagram, handler) => {
    useEventListener(diagram, 'change', handler);
  },
  diagram => diagram.update(),
  {
    onAfterSet: (diagram, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyUndoableAction<EditableDiagram>(
          diagram.props,
          path,
          oldValue,
          newValue,
          `Change diagram ${path}`,
          () => diagram.update()
        )
      );
    }
  }
);

export const useSnapManagerProperty: PropertyHook<EditableDiagram, SnapManagerConfigProps> =
  makePropertyHook<EditableDiagram, SnapManagerConfigProps>(
    diagram => diagram.snapManagerConfig,
    (diagram, handler) => {
      useEventListener(diagram.snapManagerConfig, 'change', handler);
    },
    diagram => diagram.snapManagerConfig.commit()
  );

export const useEdgeProperty: PropertyArrayHook<EditableDiagram, EdgeProps> = makePropertyArrayHook<
  EditableDiagram,
  DiagramEdge,
  EdgeProps
>(
  diagram => diagram.selectionState.edges,
  edge => edge.props,
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  (diagram, edge) => diagram.updateElement(edge),
  {
    onAfterSet: (diagram, edges, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramEdge>(
          edges,
          path,
          oldValue,
          newValue,
          `Change edge ${path}`,
          edge => edge.props,
          edge => diagram.updateElement(edge)
        )
      );
    }
  }
);

export const useNodeProperty: PropertyArrayHook<EditableDiagram, NodeProps> = makePropertyArrayHook<
  EditableDiagram,
  DiagramNode,
  NodeProps
>(
  diagram => diagram.selectionState.nodes,
  node => node.props,
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  (diagram, node) => diagram.updateElement(node),
  {
    onAfterSet: (diagram, nodes, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramNode>(
          nodes,
          path,
          oldValue,
          newValue,
          `Change node ${path}`,
          node => node.props,
          node => diagram.updateElement(node)
        )
      );
    }
  }
);

export const useElementProperty: PropertyArrayHook<EditableDiagram, ElementProps> =
  makePropertyArrayHook<EditableDiagram, DiagramEdge | DiagramNode, ElementProps>(
    diagram => diagram.selectionState.elements,
    element => element.props,
    (diagram, handler) => {
      useEventListener(diagram.selectionState, 'change', handler);
    },
    (diagram, element) => diagram.updateElement(element),
    {
      onAfterSet: (diagram, elements, path, oldValue, newValue) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramEdge | DiagramNode>(
            elements,
            path,
            oldValue,
            newValue,
            `Change element ${path}`,
            element => element.props,
            element => diagram.updateElement(element)
          )
        );
      }
    }
  );
