import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { FlexShapeNodeDefinition } from '@diagram-craft/canvas/node-types/FlexShapeNodeDefinition';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import { DeepReadonly } from '@diagram-craft/utils/types';

export const registerC4Shapes = async (r: NodeDefinitionRegistry) => {
  r.register(
    new FlexShapeNodeDefinition('mxgraph.c4.person2', 'C4 Person', {
      isGroup: false,
      boundary: new RectNodeDefinition(),
      drawBoundary: false,
      text: undefined,
      components: [
        {
          id: 'body',
          nodeType: 'rounded-rect',
          bounds: { x: 0, y: 0, w: 1, h: 1, r: 0 },
          offset: { x: 0, y: 60, w: 0, h: -60 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 40
            },
            text: {}
          }),
          text: (p: NodeProps | DeepReadonly<NodeProps>) => ({
            id: '1',
            text: p.text!
          })
        },
        {
          id: 'head',
          nodeType: 'circle',
          bounds: { x: 0.5, y: 0, w: 0, h: 0, r: 0 },
          offset: { x: -40, y: 0, h: 80, w: 80 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            text: {}
          })
        }
      ]
    }),
    { hidden: true }
  );

  r.register(
    new FlexShapeNodeDefinition('mxgraph.c4.webBrowserContainer2', 'C4 Web Browser', {
      isGroup: false,
      boundary: new RoundedRectNodeDefinition(),
      drawBoundary: false,
      text: undefined,
      components: [
        {
          id: 'bg',
          nodeType: 'rounded-rect',
          bounds: { x: 0, y: 0, w: 1, h: 1, r: 0 },
          offset: { x: 0, y: 0, w: 0, h: 0 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            fill: {
              enabled: true,
              type: 'solid',
              color: p.stroke!.color
            }
          })
        },
        {
          id: 'url',
          nodeType: 'rounded-rect',
          bounds: { x: 0, y: 0, w: 1, h: 0, r: 0 },
          offset: { x: 5, y: 5, w: -60, h: 12 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 4
            },
            stroke: {
              enabled: false
            },
            text: undefined
          })
        },
        {
          id: 'btn1',
          nodeType: 'rounded-rect',
          bounds: { x: 1, y: 0, w: 0, h: 0, r: 0 },
          offset: { x: -50, y: 5, w: 12, h: 12 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 4
            },
            stroke: {
              enabled: false
            },
            text: undefined
          })
        },
        {
          id: 'btn2',
          nodeType: 'rounded-rect',
          bounds: { x: 1, y: 0, w: 0, h: 0, r: 0 },
          offset: { x: -34, y: 5, w: 12, h: 12 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 4
            },
            stroke: {
              enabled: false
            },
            text: undefined
          })
        },
        {
          id: 'btn3',
          nodeType: 'rounded-rect',
          bounds: { x: 1, y: 0, w: 0, h: 0, r: 0 },
          offset: { x: -17, y: 5, w: 12, h: 12 },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 4
            },
            stroke: {
              enabled: false
            },
            text: undefined
          })
        },
        {
          id: 'content',
          nodeType: 'rounded-rect',
          bounds: { x: 0, y: 0, w: 1, h: 1, r: 0 },
          offset: { x: 5, y: 22, w: -10, h: -27 },
          text: {
            id: '1'
          },
          props: (p): NodeProps => ({
            ...(p as NodeProps),
            shapeRoundedRect: {
              radius: 8
            },
            stroke: {
              enabled: false
            }
          })
        }
      ]
    }),
    {
      hidden: true
    }
  );
};
