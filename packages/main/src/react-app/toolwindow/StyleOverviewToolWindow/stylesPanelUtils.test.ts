import { describe, expect, test } from 'vitest';
import { _test, extractPropsToConsider, type StylesheetGroup } from './stylesPanelUtils';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { ElementProps } from '@diagram-craft/model/diagramProps';
import { UOW } from '@diagram-craft/model/uow';

const { computeStyleDifferences, sortGroups } = _test;

describe('stylesPanelUtils', () => {
  describe('extractPropsToConsider', () => {
    test('extracts fill props for nodes when filter is "fill"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(
          props => ((props.fill = { color: '#ff0000' }), (props.stroke = { color: '#00ff00' })),
          UOW.uow()
        )
      );

      const result = extractPropsToConsider(node.storedProps, 'fill', true);

      expect(result).toEqual({ fill: { color: '#ff0000' } });
      expect(result).not.toHaveProperty('stroke');
    });

    test('returns empty object for fill filter on edges', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      layer.addNode({ id: 'start' });
      layer.addNode({ id: 'end' });
      const edge = layer.addEdge({ startNodeId: 'start', endNodeId: 'end' });

      const result = extractPropsToConsider(edge.storedProps, 'fill', false);

      expect(result).toEqual({});
    });

    test('extracts stroke props for nodes when filter is "stroke"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(props => {
          props.stroke = { color: '#00ff00', width: 2 };
          props.fill = { color: '#ff0000' };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(node.storedProps, 'stroke', true);

      expect(result).toEqual({ stroke: { color: '#00ff00', width: 2 } });
      expect(result).not.toHaveProperty('fill');
    });

    test('extracts stroke and arrow props for edges when filter is "stroke"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      layer.addNode({ id: 'start' });
      layer.addNode({ id: 'end' });
      const edge = layer.addEdge({ startNodeId: 'start', endNodeId: 'end' });
      UOW.execute(diagram, () =>
        edge.updateProps(props => {
          props.stroke = { color: '#00ff00', width: 2 };
          props.arrow = { start: { type: 'SQUARE' }, end: { type: 'ARROW' } };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(edge.storedProps, 'stroke', false);

      expect(result).toHaveProperty('stroke');
      expect(result).toHaveProperty('arrow');
    });

    test('extracts shadow props when filter is "shadow"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(
          props => (
            (props.shadow = { enabled: true, color: '#000000' }),
            (props.fill = { color: '#ff0000' })
          ),
          UOW.uow()
        )
      );

      const result = extractPropsToConsider(node.storedProps, 'shadow', true);

      expect(result).toEqual({ shadow: { enabled: true, color: '#000000' } });
      expect(result).not.toHaveProperty('fill');
    });

    test('extracts effects props when filter is "effects"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(props => {
          props.effects = { blur: 5, opacity: 0.8 };
          props.fill = { color: '#ff0000' };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(node.storedProps, 'effects', true);

      expect(result).toEqual({ effects: { blur: 5, opacity: 0.8 } });
      expect(result).not.toHaveProperty('fill');
    });

    test('extracts text props for nodes when filter is "text"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(props => {
          props.text = { font: 'Arial', fontSize: 14 };
          props.fill = { color: '#ff0000' };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(node.storedProps, 'text', true);

      expect(result).toEqual({ text: { font: 'Arial', fontSize: 14 } });
      expect(result).not.toHaveProperty('fill');
    });

    test('returns empty object for text filter on edges', () => {
      const { layer } = TestModel.newDiagramWithLayer();
      layer.addNode({ id: 'start' });
      layer.addNode({ id: 'end' });
      const edge = layer.addEdge({ startNodeId: 'start', endNodeId: 'end' });

      const result = extractPropsToConsider(edge.storedProps, 'text', false);

      expect(result).toEqual({});
    });

    test('extracts all appearance props for nodes when filter is "all"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();
      UOW.execute(diagram, () =>
        node.updateProps(props => {
          props.fill = { color: '#ff0000' };
          props.stroke = { color: '#00ff00' };
          props.shadow = { enabled: true };
          props.effects = { blur: 5 };
          props.text = { font: 'Arial' };
          props.geometry = { flipV: true };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(node.storedProps, 'all', true);

      expect(result).toHaveProperty('fill');
      expect(result).toHaveProperty('stroke');
      expect(result).toHaveProperty('shadow');
      expect(result).toHaveProperty('effects');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('geometry');
    });

    test('extracts all appearance props for edges when filter is "all"', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      layer.addNode({ id: 'start' });
      layer.addNode({ id: 'end' });
      const edge = layer.addEdge({ startNodeId: 'start', endNodeId: 'end' });
      UOW.execute(diagram, () =>
        edge.updateProps(props => {
          props.stroke = { color: '#00ff00' };
          props.shadow = { enabled: true };
          props.effects = { opacity: 5 };
          props.arrow = { start: { type: 'SQUARE' } };
        }, UOW.uow())
      );

      const result = extractPropsToConsider(edge.storedProps, 'all', false);

      expect(result).toHaveProperty('stroke');
      expect(result).toHaveProperty('shadow');
      expect(result).toHaveProperty('effects');
      expect(result).toHaveProperty('arrow');
      expect(result).not.toHaveProperty('fill');
      expect(result).not.toHaveProperty('text');
    });
  });

  describe('computeStyleDifferences', () => {
    test('returns empty array when stylesheetProps is undefined', () => {
      const elementProps = { fill: { color: '#ff0000' } };

      const result = computeStyleDifferences(elementProps, undefined, true);

      expect(result.differences).toEqual([]);
    });

    test('detects fill color difference for nodes', () => {
      const elementProps = { fill: { color: '#ff0000' } };
      const stylesheetProps = { fill: { color: '#00ff00' } };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toContain('fill.color = #ff0000');
    });

    test('detects stroke width difference', () => {
      const elementProps = { stroke: { width: 3 } };
      const stylesheetProps = { stroke: { width: 1 } };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toContain('stroke.width = 3');
    });

    test('detects multiple nested property differences', () => {
      const elementProps = {
        fill: { color: '#ff0000' },
        stroke: { width: 3, color: '#0000ff' }
      };
      const stylesheetProps = {
        fill: { color: '#00ff00' },
        stroke: { width: 1, color: '#0000ff' }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toContain('fill.color = #ff0000');
      expect(result.differences).toContain('stroke.width = 3');
      expect(result.differences).not.toContain('stroke.color');
    });

    test('ignores properties not present in element props', () => {
      const elementProps = { fill: { color: '#ff0000' } };
      const stylesheetProps = {
        fill: { color: '#ff0000' },
        stroke: { width: 1 }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toEqual([]);
    });

    test('handles text properties', () => {
      const elementProps = {
        text: { font: 'Arial', fontSize: 16, bold: true }
      };
      const stylesheetProps = {
        text: { font: 'Helvetica', fontSize: 14, bold: false }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toContain('text.font = Arial');
      expect(result.differences).toContain('text.fontSize = 16');
      expect(result.differences).toContain('text.bold = true');
    });

    test('detects deep nested property differences', () => {
      const elementProps = {
        shadow: { enabled: true, color: '#000000', blur: 5 }
      };
      const stylesheetProps = {
        shadow: { enabled: true, color: '#000000', blur: 3 }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toContain('shadow.blur = 5');
    });

    test('compares arrays correctly', () => {
      const elementProps: ElementProps = {
        effects: { opacity: 0.5, rounding: true }
      };
      const stylesheetProps: ElementProps = {
        effects: { rounding: true }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences.length).toBeGreaterThan(0);
    });

    test('handles edge props with isNodeStyle=false', () => {
      const elementProps = {
        arrow: { start: { type: 'SQUARE' }, end: { type: 'ARROW' } }
      };
      const stylesheetProps = {
        arrow: { start: { type: 'NONE' }, end: { type: 'ARROW' } }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, false);

      expect(result.differences.some(diff => diff.includes('arrow.start'))).toBe(true);
    });

    test('returns empty array when all properties match', () => {
      const elementProps = {
        fill: { color: '#ff0000' },
        stroke: { width: 2 }
      };
      const stylesheetProps = {
        fill: { color: '#ff0000' },
        stroke: { width: 2 }
      };

      const result = computeStyleDifferences(elementProps, stylesheetProps, true);

      expect(result.differences).toEqual([]);
    });
  });

  describe('sortGroups', () => {
    test('sorts named stylesheets alphabetically', () => {
      const groups: StylesheetGroup<any>[] = [
        {
          stylesheet: { id: '2', name: 'Zebra', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '1', name: 'Apple', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '3', name: 'Banana', type: 'node' } as any,
          styles: [],
          totalElements: 0
        }
      ];

      const result = sortGroups(groups);

      expect(result[0]!.stylesheet?.name).toBe('Apple');
      expect(result[1]!.stylesheet?.name).toBe('Banana');
      expect(result[2]!.stylesheet?.name).toBe('Zebra');
    });

    test('places groups without stylesheet at the end', () => {
      const groups: StylesheetGroup<any>[] = [
        {
          stylesheet: undefined,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '1', name: 'First', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '2', name: 'Second', type: 'node' } as any,
          styles: [],
          totalElements: 0
        }
      ];

      const result = sortGroups([...groups]);

      expect(result[0]!.stylesheet?.name).toBe('First');
      expect(result[1]!.stylesheet?.name).toBe('Second');
      expect(result[2]!.stylesheet).toBeUndefined();
    });

    test('handles groups with null stylesheet id separately', () => {
      const groups: StylesheetGroup<any>[] = [
        {
          stylesheet: { id: null, name: 'Null ID', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '1', name: 'Named', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: null, name: 'Another Null', type: 'node' } as any,
          styles: [],
          totalElements: 0
        }
      ];

      const result = sortGroups([...groups]);

      expect(result[0]!.stylesheet?.name).toBe('Named');
      // Groups with null id go to the end
      expect(result[1]!.stylesheet?.id).toBeNull();
      expect(result[2]!.stylesheet?.id).toBeNull();
    });

    test('returns empty array for empty input', () => {
      const result = sortGroups([]);

      expect(result).toEqual([]);
    });

    test('handles single group', () => {
      const groups: StylesheetGroup<any>[] = [
        {
          stylesheet: { id: '1', name: 'Only', type: 'node' } as any,
          styles: [],
          totalElements: 0
        }
      ];

      const result = sortGroups(groups);

      expect(result).toHaveLength(1);
      expect(result[0]!.stylesheet?.name).toBe('Only');
    });

    test('case-insensitive alphabetical sorting', () => {
      const groups: StylesheetGroup<any>[] = [
        {
          stylesheet: { id: '1', name: 'zebra', type: 'node' } as any,
          styles: [],
          totalElements: 0
        },
        {
          stylesheet: { id: '2', name: 'Apple', type: 'node' } as any,
          styles: [],
          totalElements: 0
        }
      ];

      const result = sortGroups(groups);

      expect(result[0]!.stylesheet?.name).toBe('Apple');
      expect(result[1]!.stylesheet?.name).toBe('zebra');
    });
  });
});
