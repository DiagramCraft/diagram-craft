import { useEventListener } from './useEventListener';
import { makePropertyArrayHook, makePropertyHook } from './usePropertyFactory';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import {
  Defaults,
  edgeDefaults,
  elementDefaults,
  nodeDefaults
} from '@diagram-craft/model/diagramDefaults';
import type {
  DiagramProps,
  EdgeProps,
  ElementMetadata,
  ElementProps,
  NodeProps
} from '@diagram-craft/model/diagramProps';

export const useDiagramProperty = makePropertyHook<DiagramProps>(
  path => `Change diagram ${path}`,
  diagram => diagram.props,
  (diagram, uow, callback) => diagram.updateProps(callback, uow),
  (diagram, handler) => useEventListener(diagram, 'diagramChange', handler)
);

export const useEdgeProperty = makePropertyArrayHook<DiagramEdge, EdgeProps>(
  path => `Change edge ${path}`,
  diagram => diagram.selection.edges,
  edge => edge.editProps,
  edge => edge.storedProps,
  (edge, path) => edge.getPropsInfo(path),
  (element, uow, cb) => element.updateProps(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  edgeDefaults
);

export const useNodeProperty = makePropertyArrayHook<DiagramNode, NodeProps>(
  path => `Change node ${path}`,
  diagram => diagram.selection.nodes,
  node => node.editProps,
  node => node.storedProps,
  (node, path, defaultValue) => node.getPropsInfo(path, defaultValue),
  (element, uow, cb) => element.updateProps(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  nodeDefaults
);

export const useElementProperty = makePropertyArrayHook<DiagramElement, ElementProps>(
  path => `Change element ${path}`,
  diagram => diagram.selection.elements,
  element => element.editProps,
  element => element.storedProps,
  (element, path) => element.getPropsInfo(path),
  (element, uow, cb) => element.updateProps(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  elementDefaults
);

export const useElementMetadata = makePropertyArrayHook<DiagramElement, ElementMetadata>(
  path => `Change element ${path}`,
  diagram => diagram.selection.elements,
  element => element.metadata,
  element => element.metadata,
  () => [],
  (element, uow, cb) => element.updateMetadata(cb, uow),
  (diagram, handler) => useEventListener(diagram.selection, 'change', handler),
  new Defaults<ElementMetadata>() // empty defaults
);
