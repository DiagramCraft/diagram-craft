import { Endpoint, FreeEndpoint } from './endpoint';
import type { Waypoint } from './diagramEdge';
import { type DiagramEdge, type EdgePropsForEditing, SimpleDiagramEdge } from './diagramEdge';
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
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import type { DiagramElementCRDT } from './diagramElement';
import { EdgeProps, ElementMetadata } from './diagramProps';
import { DiagramEdgeSnapshot, DiagramNodeSnapshot } from '@diagram-craft/model/diagramElement.uow';
import { Point } from '@diagram-craft/geometry/point';
import { newid } from '@diagram-craft/utils/id';

export const ElementFactory = {
  node(props: {
    id?: string;
    nodeType?: 'group' | string;
    bounds?: Box;
    layer: RegularLayer | ModificationLayer;
    props?: NodePropsForEditing;
    metadata?: ElementMetadata;
    texts?: NodeTexts;
    anchorCache?: ReadonlyArray<Anchor>;
  }) {
    return SimpleDiagramNode._create(
      props.id ?? newid(),
      props.nodeType ?? 'rect',
      props.bounds ?? Box.unit(),
      props.layer,
      props.props ?? {},
      props.metadata ?? {},
      props.texts ?? { text: '' },
      props.anchorCache
    )!;
  },

  edge(props: {
    id?: string;
    start: Endpoint;
    end: Endpoint;
    props?: EdgePropsForEditing;
    metadata?: ElementMetadata;
    waypoints?: ReadonlyArray<Waypoint>;
    layer: RegularLayer | ModificationLayer;
  }) {
    return SimpleDiagramEdge._create(
      props.id ?? newid(),
      props.start,
      props.end,
      props.props ?? {},
      props.metadata ?? {},
      props.waypoints ?? [],
      props.layer
    )!;
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

  nodeFromSnapshot(s: DiagramNodeSnapshot, layer: RegularLayer | ModificationLayer) {
    return ElementFactory.node({ ...s, layer });
  },

  edgeFromSnapshot(s: DiagramEdgeSnapshot, layer: RegularLayer | ModificationLayer) {
    return ElementFactory.edge({
      id: s.id,
      start: new FreeEndpoint(Point.of(0, 0)),
      end: new FreeEndpoint(Point.of(0, 0)),
      props: s.props as EdgeProps,
      metadata: s.metadata,
      layer
    });
  }
};
