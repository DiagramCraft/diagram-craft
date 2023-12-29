import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import {
  makePropertyArrayHook,
  makePropertyHook,
  PropertyArrayHook,
  PropertyArrayUndoableAction,
  PropertyHook,
  PropertyUndoableAction
} from './usePropertyFactory.ts';
import { Diagram } from '../../model/diagram.ts';
import { SnapManagerConfigProps } from '../../model/snap/snapManagerConfig.ts';
import { DiagramElement } from '../../model/diagramElement.ts';

export const useDiagramProperty: PropertyHook<Diagram, DiagramProps> = makePropertyHook<
  Diagram,
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
        new PropertyUndoableAction<Diagram>(
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

export const useSnapManagerProperty: PropertyHook<Diagram, SnapManagerConfigProps> =
  makePropertyHook<Diagram, SnapManagerConfigProps>(
    diagram => diagram.snapManagerConfig,
    (diagram, handler) => {
      useEventListener(diagram.snapManagerConfig, 'change', handler);
    },
    diagram => diagram.snapManagerConfig.commit()
  );

export const useEdgeProperty: PropertyArrayHook<Diagram, EdgeProps> = makePropertyArrayHook<
  Diagram,
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

export const useNodeProperty: PropertyArrayHook<Diagram, NodeProps> = makePropertyArrayHook<
  Diagram,
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

export const useElementProperty: PropertyArrayHook<Diagram, ElementProps> = makePropertyArrayHook<
  Diagram,
  DiagramElement,
  ElementProps
>(
  // TODO: This is to avoid issue with Readonly, but it's not ideal
  //       maybe change makePropertyArrayHook
  diagram => [...diagram.selectionState.elements],
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
