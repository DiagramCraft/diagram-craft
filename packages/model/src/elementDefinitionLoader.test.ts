import { describe, expect, test } from 'vitest';
import { NODE_LINK_POPUP_NO_SHAPE_ID, type StencilPackage, type StencilSubPackage } from './stencilRegistry';
import { YamlStencilLoader } from './elementDefinitionLoader';
import { TestModel } from './test-support/testModel';
import { isNode } from './diagramElement';

describe('YamlStencilLoader', () => {
  test('merges pickerProps into props only for picker rendering', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };
    new YamlStencilLoader(pkg).registerPackage({
      stencils: [
        {
          id: 'picker-props',
          node: {
            id: 'group-1',
            type: 'node',
            nodeType: 'group',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {
              stroke: {
                color: 'blue',
                width: 2
              }
            },
            pickerProps: {
              stroke: {
                color: 'green'
              },
              fill: {
                color: 'yellow'
              }
            },
            texts: { text: '' },
            metadata: {},
            children: [
              {
                id: 'child-1',
                type: 'node',
                nodeType: 'rect',
                bounds: { x: 10, y: 10, w: 80, h: 40, r: 0 },
                props: {
                  fill: {
                    color: 'red'
                  },
                  stroke: {
                    width: 3
                  }
                },
                pickerProps: {
                  stroke: {
                    color: 'black'
                  }
                },
                texts: { text: '' },
                metadata: {}
              }
            ]
          }
        }
      ]
    });
    const [stencil] = pkg.stencils;

    expect(stencil).toBeDefined();
    if (!stencil) {
      throw new Error('Expected stencil');
    }

    const registry = TestModel.newDocument().registry;
    const canvasElements = stencil.forCanvas(registry).elements;
    const pickerElements = stencil.forPicker(registry).elements;

    expect(isNode(canvasElements[0])).toBe(true);
    expect(isNode(pickerElements[0])).toBe(true);
    if (!isNode(canvasElements[0]) || !isNode(pickerElements[0])) {
      throw new Error('Expected node stencil');
    }

    expect(canvasElements[0].renderProps.stroke.color).toBe('blue');
    expect(canvasElements[0].renderProps.stroke.width).toBe(2);
    expect(canvasElements[0].renderProps.fill.color).not.toBe('yellow');

    expect(pickerElements[0].renderProps.stroke.color).toBe('green');
    expect(pickerElements[0].renderProps.stroke.width).toBe(2);
    expect(pickerElements[0].renderProps.fill.color).toBe('yellow');

    const canvasChild = canvasElements[0].children[0];
    const pickerChild = pickerElements[0].children[0];
    expect(isNode(canvasChild)).toBe(true);
    expect(isNode(pickerChild)).toBe(true);
    if (!isNode(canvasChild) || !isNode(pickerChild)) {
      throw new Error('Expected child node');
    }

    expect(canvasChild.renderProps.fill.color).toBe('red');
    expect(canvasChild.renderProps.stroke.width).toBe(3);
    expect(canvasChild.renderProps.stroke.color).not.toBe('black');

    expect(pickerChild.renderProps.fill.color).toBe('red');
    expect(pickerChild.renderProps.stroke.width).toBe(3);
    expect(pickerChild.renderProps.stroke.color).toBe('black');
  });

  test('resolves relative node link stencil references within the same yaml file', () => {
    const subPackage: StencilSubPackage = { id: 'class', name: 'Class', stencils: [] };
    const pkg: StencilPackage = {
      id: 'uml',
      stencils: [],
      type: 'default' as const,
      subPackages: [subPackage]
    };

    new YamlStencilLoader(pkg).registerSubPackage('class', {
      stencils: [
        {
          id: 'source',
          name: 'Source',
          settings: {
            nodeLinkOptions: {
              nodeStencilIds: ['target', 'external@@already-qualified', NODE_LINK_POPUP_NO_SHAPE_ID],
              allowedCombinations: [
                { nodeStencilId: 'target', edgeStylesheetId: 'edge-a' },
                { nodeStencilId: 'external@@already-qualified', edgeStylesheetId: 'edge-b' }
              ]
            }
          },
          node: {
            id: 'source-node',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        },
        {
          id: 'target',
          name: 'Target',
          node: {
            id: 'target-node',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 80, h: 60, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        }
      ]
    });
    const [stencil] = subPackage.stencils;

    expect(stencil?.nodeLinkOptions).toEqual({
      nodeStencilIds: [
        'uml@@class@@target',
        'external@@already-qualified',
        NODE_LINK_POPUP_NO_SHAPE_ID
      ],
      allowedCombinations: [
        { nodeStencilId: 'uml@@class@@target', edgeStylesheetId: 'edge-a' },
        { nodeStencilId: 'external@@already-qualified', edgeStylesheetId: 'edge-b' }
      ]
    });
    expect(pkg.stencils).toHaveLength(0);
    expect(subPackage.stencils).toHaveLength(2);
  });
});
