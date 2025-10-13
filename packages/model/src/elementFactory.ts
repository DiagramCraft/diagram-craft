import type { Endpoint } from './endpoint';
import { type DiagramEdge, type EdgePropsForEditing, SimpleDiagramEdge } from './diagramEdge';
import type { Waypoint } from './types';
import type { RegularLayer } from './diagramLayerRegular';
import type { ModificationLayer } from './diagramLayerModification';
import { Box } from '@diagram-craft/geometry/box';
import { Anchor } from './anchor';
import {
  type DiagramNode,
  type NodePropsForEditing,
  type NodeTexts,
  SimpleDiagramNode
} from './diagramNode';
import type { CRDTMap } from './collaboration/crdt';
import type { DiagramElementCRDT } from './diagramElement';

export const ElementFactory = {
  edge(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgePropsForEditing,
    metadata: ElementMetadata,
    midpoints: ReadonlyArray<Waypoint>,
    layer: RegularLayer | ModificationLayer
  ) {
    return SimpleDiagramEdge._create(id, start, end, props, metadata, midpoints, layer)!;
  },

  emptyEdge(
    id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ): DiagramEdge {
    return SimpleDiagramEdge._createEmpty(id, layer, crdt);
  },

  emptyNode(
    id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ): DiagramNode {
    return SimpleDiagramNode._createEmpty(id, layer, crdt);
  },

  node(
    id: string,
    nodeType: 'group' | string,
    bounds: Box,
    layer: RegularLayer | ModificationLayer,
    props: NodePropsForEditing,
    metadata: ElementMetadata,
    text: NodeTexts = { text: '' },
    anchorCache?: ReadonlyArray<Anchor>
  ) {
    return SimpleDiagramNode._create(
      id,
      nodeType,
      bounds,
      layer,
      props,
      metadata,
      text,
      anchorCache
    )!;
  }
};
