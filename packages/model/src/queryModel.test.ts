import { describe, expect, it } from 'vitest';
import { parseAndQuery } from 'embeddable-jq';
import { TestDiagramBuilder, TestModel } from './test-support/testModel';
import { QueryDiagram, QueryElement, QueryLayer } from './queryModel';

describe('queryModel', () => {
  it('exposes element type for DJQL queries', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }]
    });
    layer.addEdge({ id: 'edge-1', startNodeId: 'node-1' });

    const result = parseAndQuery(
      '.elements[] | select(.type == "node") | .id',
      [QueryLayer.fromLayer(diagram.activeLayer)]
    );

    expect(result).toEqual(['node-1']);
  });

  it('wraps parent diagrams in the query facade', () => {
    const document = TestModel.newDocument();
    const parentDiagram = new TestDiagramBuilder(document, 'parent');
    const childDiagram = new TestDiagramBuilder(document, 'child');

    document.addDiagram(parentDiagram);
    document.addDiagram(childDiagram, parentDiagram);

    const queryDiagram = new QueryDiagram(childDiagram);

    expect(queryDiagram.parent).toBeInstanceOf(QueryDiagram);
    expect(queryDiagram.parent?.id).toBe('parent');
    expect(queryDiagram.parent?.parent).toBeUndefined();
  });

  it('includes type in serialized query elements', () => {
    const { layer } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }]
    });

    const queryElement = QueryElement.fromElement(layer.elements[0]!);

    expect(queryElement.toJSON()).toMatchObject({
      id: 'node-1',
      type: 'node'
    });
  });
});
