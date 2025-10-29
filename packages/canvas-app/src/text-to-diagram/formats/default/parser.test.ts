import { describe, test, expect } from 'vitest';
import { defaultParser } from './parser';

const parse = (text: string) => defaultParser.parse(text);

describe('parser', () => {
  test('parses simple node', () => {
    const input = '4: rect';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '4',
      type: 'node',
      shape: 'rect',
      line: 0
    });
  });

  test('parses node with name', () => {
    const input = '3: rounded-rect "Lorem"';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '3',
      type: 'node',
      shape: 'rounded-rect',
      name: 'Lorem',
      line: 0
    });
  });

  test('parses node with props', () => {
    const input = `cukdoml: text "Lorem ipsum" {
  props: "stroke.enabled=false;fill.enabled=true"
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'cukdoml',
      type: 'node',
      shape: 'text',
      name: 'Lorem ipsum',
      props: {
        stroke: { enabled: false },
        fill: { enabled: true }
      }
    });
  });

  test('parses simple edge', () => {
    const input = 'e2: edge';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e2',
      type: 'edge',
      line: 0
    });
  });

  test('parses edge with connections', () => {
    const input = 'e1: edge 3 -> 4';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      from: '3',
      to: '4',
      line: 0
    });
  });

  test('parses edge with label', () => {
    const input = 'e1: edge 3 -> 4 "Hello world"';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      from: '3',
      to: '4'
    });
  });

  test('parses edge with props and children', () => {
    const input = `e1: edge 3 -> 4 "Hello world" {
  t2: text "Hello world" {
    props: "labelForEdgeId=e1;text.align=center;fill.enabled=true;fill.color=#ffffff"
  }
  props: "arrow.start.type=SQUARE_ARROW_OUTLINE;arrow.end.type=CROWS_FEET_BAR"
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      from: '3',
      to: '4',
      props: {
        arrow: {
          start: { type: 'SQUARE_ARROW_OUTLINE' },
          end: { type: 'CROWS_FEET_BAR' }
        }
      },
      children: [
        {
          id: 't2',
          type: 'node',
          shape: 'text',
          name: 'Hello world',
          props: {
            labelForEdgeId: 'e1',
            text: { align: 'center' },
            fill: { enabled: true, color: '#ffffff' }
          }
        }
      ]
    });
  });

  test('parses nested structure (table example)', () => {
    const input = `epb7kko: table {
  el4hq06: tableRow {
    cukdoml: text "Lorem ipsum" {
      props: "stroke.enabled=false;fill.enabled=true"
    }
    3p0ktgd: text "Dolor sit amet" {
      props: "stroke.enabled=false;fill.enabled=true;fill.color=#f7edfe"
    }
    props: "custom.container.containerResize=both;custom.container.layout=horizontal"
  }
  props: "custom.container.containerResize=both;custom.container.layout=vertical"
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'epb7kko',
      type: 'node',
      shape: 'table',
      props: {
        custom: {
          container: {
            containerResize: 'both',
            layout: 'vertical'
          }
        }
      }
    });

    const table = result.elements[0];
    if (table?.type === 'node') {
      expect(table.children).toHaveLength(1);
      expect(table.children?.[0]).toMatchObject({
        id: 'el4hq06',
        type: 'node',
        shape: 'tableRow',
        props: {
          custom: {
            container: {
              containerResize: 'both',
              layout: 'horizontal'
            }
          }
        }
      });

      const row = table.children?.[0];
      if (row?.type === 'node') {
        expect(row.children).toHaveLength(2);
        expect(row.children?.[0]).toMatchObject({
          id: 'cukdoml',
          type: 'node',
          shape: 'text',
          name: 'Lorem ipsum'
        });
      }
    }
  });

  test('parses multiple elements', () => {
    const input = `e1: edge 3 -> 4

3: rounded-rect "Lorem"

4: rect`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(3);
    expect(result.elements[0]).toMatchObject({ id: 'e1', type: 'edge' });
    expect(result.elements[1]).toMatchObject({ id: '3', type: 'node' });
    expect(result.elements[2]).toMatchObject({ id: '4', type: 'node' });
  });

  test('handles syntax errors gracefully', () => {
    const input = `1: rect
invalid line without colon
3: text "Hello"`;
    const result = parse(input);

    // Should have an error on line 1 (0-indexed)
    expect(result.errors.get(1)).toBeTruthy();
    // Should still parse valid lines
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0]?.id).toBe('1');
    expect(result.elements[1]?.id).toBe('3');
  });

  test('handles unterminated string', () => {
    const input = '1: text "unterminated';
    const result = parse(input);

    // Should report error for unterminated string
    expect(result.errors.get(0)).toBe('Unterminated string literal');

    // Should still parse the element for error recovery
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '1',
      type: 'node',
      shape: 'text',
      name: 'unterminated'
    });
  });

  test('handles missing closing brace', () => {
    const input = `1: rect {
  props: "test=value"`;
    const result = parse(input);

    // Should report error about missing brace
    expect(result.errors.size).toBeGreaterThan(0);
    // Should still parse the element
    expect(result.elements).toHaveLength(1);
  });

  test('parses edge with only from connection', () => {
    const input = 'e1: edge 3 ->';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      from: '3'
    });
  });

  test('parses edge with only to connection', () => {
    const input = 'e1: edge -> 4';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      to: '4'
    });
  });

  test('handles escaped characters in strings', () => {
    const input = '1: text "Hello \\"World\\""';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements[0]).toMatchObject({
      id: '1',
      type: 'node',
      shape: 'text',
      name: 'Hello "World"'
    });
  });

  test('parses element without body followed by element with body', () => {
    const input = `e2: edge

3: rounded-rect "Lorem" {
  stylesheet: / h1
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0]).toMatchObject({
      id: 'e2',
      type: 'edge'
    });
    expect(result.elements[1]).toMatchObject({
      id: '3',
      type: 'node',
      shape: 'rounded-rect',
      name: 'Lorem',
      textStylesheet: 'h1'
    });
  });

  test('parses stylesheet with both style and textStyle', () => {
    const input = `1: rect {
  stylesheet: default / h1
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '1',
      type: 'node',
      shape: 'rect',
      stylesheet: 'default',
      textStylesheet: 'h1'
    });
  });

  test('parses stylesheet with only style', () => {
    const input = `1: rect {
  stylesheet: custom-style /
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '1',
      type: 'node',
      shape: 'rect',
      stylesheet: 'custom-style'
    });
  });

  test('parses stylesheet with only textStyle', () => {
    const input = `1: rect {
  stylesheet: / h2
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '1',
      type: 'node',
      shape: 'rect',
      textStylesheet: 'h2'
    });
  });

  test('parses edge with stylesheet', () => {
    const input = `e1: edge {
  stylesheet: arrow-style
}`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e1',
      type: 'edge',
      stylesheet: 'arrow-style'
    });
  });

  test('flags unterminated string in node name', () => {
    const input = '4: rect "jkjskd';
    const result = parse(input);

    // Should report error
    expect(result.errors.get(0)).toBe('Unterminated string literal');

    // Should still parse for error recovery
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: '4',
      type: 'node',
      shape: 'rect',
      name: 'jkjskd'
    });
  });

  test('detects duplicate IDs', () => {
    const input = `1: rect
2: text "Hello"
1: circle`;
    const result = parse(input);

    // Should report duplicate ID error on both lines (0 and 2)
    expect(result.errors.get(0)).toBe('Duplicate element ID: "1"');
    expect(result.errors.get(2)).toBe('Duplicate element ID: "1"');

    // Should still parse all elements
    expect(result.elements).toHaveLength(3);
    expect(result.elements[0]).toMatchObject({ id: '1', line: 0 });
    expect(result.elements[1]).toMatchObject({ id: '2', line: 1 });
    expect(result.elements[2]).toMatchObject({ id: '1', line: 2 });
  });

  test('detects duplicate IDs in nested children', () => {
    const input = `table_1: table {
  cell_1: text "A"
  cell_1: text "B"
}`;
    const result = parse(input);

    // Should report duplicate ID error on both child lines (1 and 2)
    expect(result.errors.get(1)).toBe('Duplicate element ID: "cell_1"');
    expect(result.errors.get(2)).toBe('Duplicate element ID: "cell_1"');

    // Should still parse all elements
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({ id: 'table_1', line: 0 });
    const table = result.elements[0];
    if (table?.type === 'node') {
      expect(table.children).toHaveLength(2);
      expect(table.children?.[0]).toMatchObject({ id: 'cell_1', line: 1 });
      expect(table.children?.[1]).toMatchObject({ id: 'cell_1', line: 2 });
    }
  });

  test('detects duplicate IDs across parent and children', () => {
    const input = `parent_1: table {
  parent_1: text "Duplicate with parent"
}`;
    const result = parse(input);

    // Should report duplicate ID error on both lines (0 and 1)
    expect(result.errors.get(0)).toBe('Duplicate element ID: "parent_1"');
    expect(result.errors.get(1)).toBe('Duplicate element ID: "parent_1"');

    // Should still parse all elements
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({ id: 'parent_1', line: 0 });
    const parent = result.elements[0];
    if (parent?.type === 'node') {
      expect(parent.children).toHaveLength(1);
      expect(parent.children?.[0]).toMatchObject({ id: 'parent_1', line: 1 });
    }
  });

  test('parses node with quoted ID containing spaces', () => {
    const input = '"another id": rect "Another rectangle"';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'another id',
      type: 'node',
      shape: 'rect',
      name: 'Another rectangle',
      line: 0
    });
  });

  test('parses edge with quoted endpoint IDs containing spaces', () => {
    const input = '"e 1": edge "node 1" -> "node 2"';
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({
      id: 'e 1',
      type: 'edge',
      from: 'node 1',
      to: 'node 2',
      line: 0
    });
  });

  test('parses mixed quoted and unquoted IDs', () => {
    const input = `"my node": rect "Node with space ID"
e1: edge "my node" -> simple
simple: circle`;
    const result = parse(input);

    expect(result.errors.size).toBe(0);
    expect(result.elements).toHaveLength(3);
    expect(result.elements[0]).toMatchObject({
      id: 'my node',
      type: 'node',
      shape: 'rect',
      name: 'Node with space ID'
    });
    expect(result.elements[1]).toMatchObject({
      id: 'e1',
      type: 'edge',
      from: 'my node',
      to: 'simple'
    });
    expect(result.elements[2]).toMatchObject({
      id: 'simple',
      type: 'node',
      shape: 'circle'
    });
  });
});
