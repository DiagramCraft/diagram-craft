import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { TextNodeDefinition } from './Text.nodeType';

const makeTextNode = (props?: {
  custom?: {
    textNode?: {
      split?: string;
      columnWidths?: string;
    };
  };
}) => {
  const { layer } = TestModel.newDiagramWithLayer();
  const node = layer.addNode({
    type: 'text',
    bounds: { x: 0, y: 0, w: 100, h: 40, r: 0 },
    props
  });

  return { definition: new TextNodeDefinition(), node };
};

describe('TextNodeDefinition', () => {
  test('falls back to the default text handlers when column mode is incomplete', () => {
    const { definition, node } = makeTextNode({
      custom: {
        textNode: {
          split: ':'
        }
      }
    });

    expect(definition.getTextHandler(node)).toBe(ShapeNodeDefinition.DEFAULT_TEXT_HANDLERS);
  });

  test('preserves blank lines when rendering column layouts', () => {
    const { definition, node } = makeTextNode({
      custom: {
        textNode: {
          split: ':',
          columnWidths: '1fr, 2fr'
        }
      }
    });

    const html = definition.getTextHandler(node).inline!.storedToHTML('left:one<div></div><div>right:two</div>');

    expect(html).toContain('<div>left:</div><div>one</div>');
    expect(html).toContain('<div></div><div></div>');
    expect(html).toContain('<div>right:</div><div>two</div>');
  });

  test('does not prepend a blank line when the stored content starts with a div wrapper', () => {
    const { definition, node } = makeTextNode({
      custom: {
        textNode: {
          split: ':',
          columnWidths: '1fr, 2fr'
        }
      }
    });

    const html = definition.getTextHandler(node).inline!.storedToHTML('<div>left:one</div>');

    expect(html).not.toContain('<div></div><div></div><div>left:</div><div>one</div>');
    expect(html).toContain('<div>left:</div><div>one</div>');
  });

  test('pads missing columns while keeping the delimiter in the first column', () => {
    const { definition, node } = makeTextNode({
      custom: {
        textNode: {
          split: ':',
          columnWidths: '1fr, 2fr, 3fr'
        }
      }
    });

    const html = definition.getTextHandler(node).inline!.storedToHTML('left:middle');

    expect(html).toContain('<div>left:</div><div>middle</div><div></div>');
  });
});
