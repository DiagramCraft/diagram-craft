import { Box } from '../geometry/box.ts';
import { Point } from '../geometry/point.ts';

export interface AbstractElement {
  id: string;
  type: string;
}

export interface AbstractNode extends AbstractElement {
  type: 'node';
  nodeType: 'group' | string;
  id: string;
  bounds: Box;

  // TODO: Maybe we should make this readonly (deep)?
  props: NodeProps;
  anchors?: Anchor[];
}

export type Anchor = {
  point: Point;
  clip?: boolean;
};

export type LabelNode = {
  id: string;
  offset: Point;
  timeOffset: number;
};

export interface AbstractEdge extends AbstractElement {
  type: 'edge';
  id: string;
  waypoints?: Waypoint[];
  props: EdgeProps;

  labelNodes?: LabelNode[];
}

export type Waypoint = {
  point: Point;
  controlPoints?: [Point, Point];
};
