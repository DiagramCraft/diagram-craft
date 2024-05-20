import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { FlexShapeNodeDefinition } from '@diagram-craft/canvas/node-types/FlexShapeNodeDefinition';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { UmlModuleNodeDefinition } from './umlModule';
import { Box } from '@diagram-craft/geometry/box';
import { Style } from '../drawioReader';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { parseNum } from '../utils';

export const parseUMLModule = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  props.shapeUmlModule = {
    jettyWidth: parseNum(style.jettyWidth, 20),
    jettyHeight: parseNum(style.jettyHeight, 10)
  };
  return new DiagramNode(id, 'module', bounds, diagram, layer, props);
};

export const registerUMLShapes = async (r: NodeDefinitionRegistry) => {
  r.register(new UmlModuleNodeDefinition(), { hidden: true });

  r.register(
    new FlexShapeNodeDefinition('folder', 'UML Folder', {
      isGroup: false,
      boundary: new RectNodeDefinition(),
      drawBoundary: false,
      text: undefined,
      components: [
        {
          id: 'body',
          nodeType: 'rect',
          bounds: { x: 0, y: 0, w: 1, h: 1, r: 0 },
          offset: { x: 0, y: 15, w: 0, h: -15 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            text: undefined
          })
        },
        {
          id: 'tab',
          nodeType: 'rect',
          bounds: { x: 0, y: 0, w: 0, h: 0, r: 0 },
          offset: { x: 0, y: 0, w: 50, h: 15 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            text: undefined
          })
        },
        {
          id: 'text',
          nodeType: 'rect',
          bounds: {
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            r: 0
          },
          text: {
            id: '1'
          },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            fill: {
              enabled: false
            },
            stroke: {
              enabled: false
            }
          })
        }
      ]
    }),
    { hidden: true }
  );
};
