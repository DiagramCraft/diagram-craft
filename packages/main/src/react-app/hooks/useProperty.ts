import { useEventListener } from './useEventListener';
import {
  makePropertyArrayHook,
  makePropertyHook,
  PropertyArrayHook,
  PropertyArrayUndoableAction,
  PropertyHook,
  PropertyUndoableAction
} from './usePropertyFactory';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import {
  Defaults,
  edgeDefaults,
  elementDefaults,
  nodeDefaults
} from '@diagram-craft/model/diagramDefaults';

export const useDiagramProperty: PropertyHook<Diagram, DiagramCraft.DiagramProps> =
  makePropertyHook<Diagram, DiagramCraft.DiagramProps>(
    diagram => diagram.props,
    (diagram, callback) => diagram.updateProps(callback),
    (diagram, handler) => {
      useEventListener(diagram, 'diagramChange', handler);
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
            () => diagram.emitDiagramChange('content')
          )
        );
      }
    }
  );

export const useEdgeProperty: PropertyArrayHook<Diagram, DiagramCraft.EdgeProps> =
  makePropertyArrayHook<Diagram, DiagramEdge, DiagramCraft.EdgeProps>(
    diagram => diagram.selection.edges,
    edge => edge.editProps,
    edge => edge.storedProps,
    (edge, path) => edge.getPropsInfo(path),
    (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
    (diagram, handler) => {
      useEventListener(diagram.selection, 'change', handler);
    },
    edgeDefaults,
    {
      onAfterSet: (diagram, edges, path, oldValue, newValue, message) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramEdge, DiagramCraft.EdgeProps>(
            message ?? `Change edge ${path}`,
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

export const useNodeProperty: PropertyArrayHook<Diagram, DiagramCraft.NodeProps> =
  makePropertyArrayHook<Diagram, DiagramNode, DiagramCraft.NodeProps>(
    diagram => diagram.selection.nodes,
    node => node.editProps,
    node => node.storedProps,
    (node, path, defaultValue) => node.getPropsInfo(path, defaultValue),
    (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
    (diagram, handler) => {
      useEventListener(diagram.selection, 'change', handler);
    },
    nodeDefaults,
    {
      onAfterSet: (diagram, nodes, path, oldValue, newValue, message) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramNode, DiagramCraft.NodeProps>(
            message ?? `Change node ${path}`,
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

export const useElementProperty: PropertyArrayHook<Diagram, DiagramCraft.ElementProps> =
  makePropertyArrayHook<Diagram, DiagramElement, DiagramCraft.ElementProps>(
    // TODO: This is to avoid issue with Readonly, but it's not ideal
    //       maybe change makePropertyArrayHook
    diagram => [...diagram.selection.elements],
    element => element.editProps,
    element => element.storedProps,
    (element, path) => element.getPropsInfo(path),
    (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateProps(cb, uow)),
    (diagram, handler) => {
      useEventListener(diagram.selection, 'change', handler);
    },
    elementDefaults,
    {
      onAfterSet: (diagram, elements, path, oldValue, newValue, message) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramElement, DiagramCraft.ElementProps>(
            message ?? `Change element ${path}`,
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

export const useElementMetadata: PropertyArrayHook<Diagram, DiagramCraft.ElementMetadata> =
  makePropertyArrayHook<Diagram, DiagramElement, DiagramCraft.ElementMetadata>(
    // TODO: This is to avoid issue with Readonly, but it's not ideal
    //       maybe change makePropertyArrayHook
    diagram => [...diagram.selection.elements],
    element => element.metadata,
    element => element.metadata,
    () => [],
    (diagram, element, cb) => UnitOfWork.execute(diagram, uow => element.updateMetadata(cb, uow)),
    (diagram, handler) => {
      useEventListener(diagram.selection, 'change', handler);
    },
    new Defaults<DiagramCraft.ElementMetadata>(), // empty defaults
    {
      onAfterSet: (diagram, elements, path, oldValue, newValue, message) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramElement, DiagramCraft.ElementMetadata>(
            message ?? `Change element ${path}`,
            elements,
            path,
            oldValue,
            newValue,
            () => new UnitOfWork(diagram),
            (el: DiagramElement, uow: UnitOfWork, cb) => el.updateMetadata(cb, uow)
          )
        );
      }
    }
  );
