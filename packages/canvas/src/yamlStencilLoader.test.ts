import { describe, expect, test } from 'vitest';
import {
  NODE_LINK_POPUP_NO_SHAPE_ID,
  type StencilPackage,
  type StencilSubPackage
} from '@diagram-craft/model/stencilRegistry';
import { _test, YamlStencilLoader } from './yamlStencilLoader';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { isNode } from '@diagram-craft/model/diagramElement';

describe('YamlStencilLoader', () => {
  test('merges pickerProps into props only for picker rendering', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };
    const loader = new YamlStencilLoader(pkg);
    loader.registerPackage({
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
    loader.apply();
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

    const loader = new YamlStencilLoader(pkg);
    loader.registerSubPackage('class', {
      stencils: [
        {
          id: 'source',
          name: 'Source',
          settings: {
            nodeLinkOptions: {
              stencilIds: ['target', 'external@@already-qualified', NODE_LINK_POPUP_NO_SHAPE_ID],
              combinations: [
                { stencilId: 'target', edgeStyleId: 'edge-a' },
                { stencilId: 'external@@already-qualified', edgeStyleId: 'edge-b' }
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
    loader.apply();
    const [stencil] = subPackage.stencils;

    expect(stencil?.settings?.nodeLinkOptions).toEqual({
      stencilIds: [
        'uml@@class@@target',
        'external@@already-qualified',
        NODE_LINK_POPUP_NO_SHAPE_ID
      ],
      combinations: [
        { stencilId: 'uml@@class@@target', edgeStyleId: 'edge-a' },
        { stencilId: 'external@@already-qualified', edgeStyleId: 'edge-b' }
      ]
    });
    expect(pkg.stencils).toHaveLength(0);
    expect(subPackage.stencils).toHaveLength(2);
  });

  test('resolves relative node link stencil references across yaml files in the same subpackage', () => {
    const subPackage: StencilSubPackage = { id: 'class', name: 'Class', stencils: [] };
    const pkg: StencilPackage = {
      id: 'uml',
      stencils: [],
      type: 'default' as const,
      subPackages: [subPackage]
    };

    const loader = new YamlStencilLoader(pkg);
    loader.registerSubPackage('class', {
      stencils: [
        {
          id: 'source',
          settings: {
            nodeLinkOptions: {
              stencilIds: ['target']
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
        }
      ]
    });
    loader.registerSubPackage('class', {
      stencils: [
        {
          id: 'target',
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

    loader.apply();

    expect(subPackage.stencils[0]?.settings?.nodeLinkOptions).toEqual({
      stencilIds: ['uml@@class@@target'],
      combinations: undefined
    });
  });

  test('rejects yaml without node or elements', () => {
    expect(() =>
      _test.assertYamlStencilFile({
        stencils: [{ id: 'broken' }]
      })
    ).toThrow(/bad stencil shape broken/);
  });

  test('allows styles-only yaml validation', () => {
    expect(() =>
      _test.assertYamlStencilStylesFile({
        styles: [
          {
            id: 'shared-style',
            name: 'Shared Style',
            type: 'node'
          }
        ]
      })
    ).not.toThrow();
  });

  test('resolves string style references from the top-level styles block in apply', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };

    const loader = new YamlStencilLoader(pkg);
    loader.registerPackage({
      styles: [
        {
          id: 'shared-style',
          name: 'Shared Style',
          type: 'node',
          props: {
            stroke: {
              color: 'red'
            }
          }
        }
      ],
      stencils: [
        {
          id: 'with-style-ref',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          },
          styles: ['shared-style']
        }
      ]
    });

    expect(pkg.stencils[0]?.styles).toBeUndefined();
    loader.apply();

    expect(pkg.stencils[0]?.styles).toEqual([
      {
        id: 'shared-style',
        name: 'Shared Style',
        type: 'node',
        props: {
          stroke: {
            color: 'red'
          }
        }
      }
    ]);
  });

  test('resolves string style references across registered yaml files', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };

    const loader = new YamlStencilLoader(pkg);
    loader.registerPackage({
      styles: [
        {
          id: 'shared-style',
          name: 'Shared Style',
          type: 'node',
          props: {
            stroke: {
              color: 'red'
            }
          }
        }
      ],
      stencils: [
        {
          id: 'source',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        }
      ]
    });
    loader.registerPackage({
      stencils: [
        {
          id: 'with-style-ref',
          node: {
            id: 'node-2',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          },
          styles: ['shared-style']
        }
      ]
    });

    loader.apply();

    expect(pkg.stencils[1]?.styles).toEqual([
      {
        id: 'shared-style',
        name: 'Shared Style',
        type: 'node',
        props: {
          stroke: {
            color: 'red'
          }
        }
      }
    ]);
  });

  test('fails apply when a style reference cannot be resolved', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };

    const loader = new YamlStencilLoader(pkg);
    loader.registerPackage({
      stencils: [
        {
          id: 'with-missing-style-ref',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          },
          styles: ['missing-style']
        }
      ]
    });

    expect(() => loader.apply()).toThrow();
  });

  test('registerStyles contributes top-level styles without registering stencils', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };

    const loader = new YamlStencilLoader(pkg);
    loader.registerStyles({
      styles: [
        {
          id: 'shared-style',
          name: 'Shared Style',
          type: 'node',
          props: {
            stroke: {
              color: 'red'
            }
          }
        }
      ]
    });
    loader.registerPackage({
      stencils: [
        {
          id: 'with-style-ref',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          },
          styles: ['shared-style']
        }
      ]
    });

    expect(pkg.stencils).toHaveLength(1);
    loader.apply();

    expect(pkg.stencils[0]?.styles).toEqual([
      {
        id: 'shared-style',
        name: 'Shared Style',
        type: 'node',
        props: {
          stroke: {
            color: 'red'
          }
        }
      }
    ]);
  });

  test('uses yaml name fallback order of name, title, then stencil label', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };
    const loader = new YamlStencilLoader(pkg);
    loader.registerPackage({
      stencils: [
        {
          id: 'explicit-name',
          name: 'Explicit Name',
          title: 'Ignored Title',
          stencil: 'Ignored Stencil',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        },
        {
          id: 'title-fallback',
          title: 'Title Label',
          stencil: 'Ignored Stencil',
          node: {
            id: 'node-2',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        },
        {
          id: 'stencil-fallback',
          stencil: 'Stencil Label',
          node: {
            id: 'node-3',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        }
      ]
    });

    loader.apply();

    expect(pkg.stencils.map(stencil => stencil.name)).toEqual([
      'Explicit Name',
      'Title Label',
      'Stencil Label'
    ]);
  });

  test('preserves yaml stencil descriptions in registered stencil metadata', () => {
    const pkg: StencilPackage = {
      id: 'test',
      stencils: [],
      type: 'default' as const
    };
    const loader = new YamlStencilLoader(pkg);

    loader.registerPackage({
      stencils: [
        {
          id: 'described-stencil',
          name: 'Described Stencil',
          description: 'Shown in the hover popover.',
          node: {
            id: 'node-1',
            type: 'node',
            nodeType: 'rect',
            bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
            props: {},
            texts: { text: '' },
            metadata: {}
          }
        }
      ]
    });

    loader.apply();

    expect(pkg.stencils[0]?.description).toBe('Shown in the hover popover.');
  });
});
