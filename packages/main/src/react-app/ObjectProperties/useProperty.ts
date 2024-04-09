import { useEventListener } from '../hooks/useEventListener.ts';
import { DiagramEdge, SnapManagerConfigProps } from '@diagram-craft/model';
import { DiagramNode } from '@diagram-craft/model';
import {
  makePropertyArrayHook,
  makePropertyHook,
  PropertyArrayHook,
  PropertyArrayUndoableAction,
  PropertyHook,
  PropertyUndoableAction
} from './usePropertyFactory.ts';
import { Diagram } from '@diagram-craft/model';
import { DiagramElement } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';

export const useDiagramProperty: PropertyHook<Diagram, DiagramProps> = makePropertyHook<
  Diagram,
  DiagramProps
>(
  diagram => diagram.props,
  (diagram, callback) => {
    callback(diagram.props);
    diagram.update();
  },
  (diagram, handler) => {
    useEventListener(diagram, 'change', handler);
  },
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
    (diagram, callback) => {
      callback(diagram.snapManagerConfig);
      diagram.snapManagerConfig.commit();
    },
    (diagram, handler) => {
      useEventListener(diagram.snapManagerConfig, 'change', handler);
    }
  );

export const useEdgeProperty: PropertyArrayHook<Diagram, EdgeProps> = makePropertyArrayHook<
  Diagram,
  DiagramEdge,
  EdgeProps
>(
  diagram => diagram.selectionState.edges,
  edge => edge.propsForEditing,
  (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  {
    onAfterSet: (diagram, edges, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramEdge, EdgeProps>(
          `Change edge ${path}`,
          edges,
          path,
          oldValue,
          newValue,
          () => new UnitOfWork(diagram),
          (edge: DiagramEdge, uow: UnitOfWork, cb) => edge.updateProps(cb, uow)
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
  node => node.propsForEditing,
  (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  {
    onAfterSet: (diagram, nodes, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramNode, NodeProps>(
          `Change node ${path}`,
          nodes,
          path,
          oldValue,
          newValue,
          () => new UnitOfWork(diagram),
          (node: DiagramNode, uow: UnitOfWork, cb) => node.updateProps(cb, uow)
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
  element => element.propsForEditing,
  (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
  (diagram, handler) => {
    useEventListener(diagram.selectionState, 'change', handler);
  },
  {
    onAfterSet: (diagram, elements, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramElement, ElementProps>(
          `Change element ${path}`,
          elements,
          path,
          oldValue,
          newValue,
          () => new UnitOfWork(diagram),
          (el: DiagramElement, uow: UnitOfWork, cb) => el.updateProps(cb, uow)
        )
      );
    }
  }
);
