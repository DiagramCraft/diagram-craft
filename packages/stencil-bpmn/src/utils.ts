import { _p } from '@diagram-craft/geometry/point';
import { Anchor } from '@diagram-craft/model/anchor';
import { Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { Box } from '@diagram-craft/geometry/box';
import { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { TransformFactory } from '@diagram-craft/geometry/transform';

export const RECTANGULAR_SHAPE_ANCHORS: Anchor[] = [
  { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
  { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
  { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
  { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
  { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
];

export const renderIcon = (
  icon: Icon,
  position: Box,
  nodeProps: NodePropsForRendering,
  shapeBuilder: ShapeBuilder
) => {
  shapeBuilder.path(
    PathListBuilder.fromPathList(icon.pathList)
      .getPaths(TransformFactory.fromTo(icon.viewbox, position))
      .all(),
    undefined,
    {
      style: {
        fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
        stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none',
        strokeWidth: '1',
        strokeDasharray: 'none'
      }
    }
  );
};
