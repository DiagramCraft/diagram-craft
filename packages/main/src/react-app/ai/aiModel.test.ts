import { beforeEach, describe, expect, test } from 'vitest';
import { AIModel } from './aiModel';
import { SimplifiedDiagram } from './aiDiagramTypes';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';

describe('AIModel', () => {
  let document: DiagramDocument;
  let aiModel: AIModel;

  beforeEach(() => {
    document = new DiagramDocument(defaultRegistry());
    const { diagram } = DocumentBuilder.empty(newid(), 'Test Diagram', document);
    aiModel = new AIModel(diagram);
  });

  test('creates nodes with default values', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', text: 'Node A' },
        { id: 'B', text: 'Node B' }
      ]
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const nodes = Array.from(diagram.nodeLookup.values());
    const edges = Array.from(diagram.edgeLookup.values());

    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(0);
  });

  test('creates nodes with custom positions', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', x: 100, y: 100, width: 150, height: 100, text: 'Node A' },
        { id: 'B', x: 300, y: 100, width: 150, height: 100, text: 'Node B' }
      ],
      layout: 'manual'
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const nodes = Array.from(diagram.nodeLookup.values());

    expect(nodes[0]!.bounds.x).toBe(100);
    expect(nodes[0]!.bounds.y).toBe(100);
    expect(nodes[0]!.bounds.w).toBe(150);
    expect(nodes[0]!.bounds.h).toBe(100);
    expect(nodes[0]!.getText()).toBe('Node A');
  });

  test('applies auto-layout when layout is auto', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', text: 'Node A' },
        { id: 'B', text: 'Node B' },
        { id: 'C', text: 'Node C' }
      ],
      layout: 'auto'
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const nodes = Array.from(diagram.nodeLookup.values());

    // Verify nodes have positions assigned
    expect(nodes[0]!.bounds.x).toBeGreaterThanOrEqual(0);
    expect(nodes[0]!.bounds.y).toBeGreaterThanOrEqual(0);
    expect(nodes[1]!.bounds.x).toBeGreaterThanOrEqual(0);
    expect(nodes[2]!.bounds.x).toBeGreaterThanOrEqual(0);
  });

  test('creates edges between nodes', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', x: 100, y: 100, text: 'Node A' },
        { id: 'B', x: 300, y: 100, text: 'Node B' }
      ],
      edges: [{ from: 'A', to: 'B', fromAnchor: 'right', toAnchor: 'left' }]
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const edges = Array.from(diagram.edgeLookup.values());
    const nodes = Array.from(diagram.nodeLookup.values());

    expect(edges.length).toBe(1);

    const edge = edges[0]!;
    expect((edge.start as ConnectedEndpoint).node!.id).toBe(nodes[0]!.id);
    expect((edge.end as ConnectedEndpoint).node!.id).toBe(nodes[1]!.id);
  });

  test('creates edges with custom styling', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', x: 100, y: 100, text: 'Node A' },
        { id: 'B', x: 300, y: 100, text: 'Node B' }
      ],
      edges: [
        {
          from: 'A',
          to: 'B',
          type: 'curved',
          stroke: '#ff0000',
          strokeWidth: 3,
          endArrow: 'triangle'
        }
      ]
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const edge = Array.from(diagram.edgeLookup.values())[0]!;

    expect(edge.renderProps.type).toBe('curved');
    expect(edge.renderProps.stroke?.color).toBe('#ff0000');
    expect(edge.renderProps.stroke?.width).toBe(3);
  });

  test('creates nodes with custom types and colors', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        {
          id: 'A',
          type: 'circle',
          fill: '#fff3e0',
          stroke: '#ff6f00',
          strokeWidth: 3,
          text: 'Circle Node'
        }
      ]
    };

    aiModel.applyChange(simplified);

    const diagram = aiModel['diagram'];
    const node = Array.from(diagram.nodeLookup.values())[0]!;

    expect(node.nodeType).toBe('circle');
    expect(node.renderProps.fill?.color).toBe('#fff3e0');
    expect(node.renderProps.stroke?.color).toBe('#ff6f00');
    expect(node.renderProps.stroke?.width).toBe(3);
  });

  test('handles missing node in edge gracefully', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [{ id: 'A', text: 'Node A' }],
      edges: [{ from: 'A', to: 'NonExistent' }]
    };

    // Should not throw
    expect(() => aiModel.applyChange(simplified)).not.toThrow();

    const diagram = aiModel['diagram'];
    const edges = Array.from(diagram.edgeLookup.values());
    expect(edges.length).toBe(0);
  });

  test('exports diagram to simplified format', () => {
    const simplified: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', x: 100, y: 100, width: 120, height: 80, text: 'Node A' },
        { id: 'B', x: 300, y: 100, width: 120, height: 80, text: 'Node B' }
      ],
      edges: [{ from: 'A', to: 'B' }]
    };

    aiModel.applyChange(simplified);
    const exported = aiModel.asAIView();

    expect(exported.nodes).toHaveLength(2);
    expect(exported.edges).toHaveLength(1);
    // Text should be exported
    expect(exported.nodes![0]!.text).toBeDefined();
    expect(exported.nodes![1]!.text).toBeDefined();
  });

  test('handles action: add by appending to existing diagram', () => {
    // First create some nodes
    const initial: SimplifiedDiagram = {
      action: 'create',
      nodes: [{ id: 'A', text: 'Node A' }]
    };
    aiModel.applyChange(initial);

    // Then add more nodes
    const additional: SimplifiedDiagram = {
      action: 'add',
      nodes: [{ id: 'B', text: 'Node B' }]
    };
    aiModel.applyChange(additional);

    const diagram = aiModel['diagram'];
    const nodes = Array.from(diagram.nodeLookup.values());
    expect(nodes.length).toBe(2);
  });

  test('handles action: replace by clearing and recreating', () => {
    // First create some nodes
    const initial: SimplifiedDiagram = {
      action: 'create',
      nodes: [
        { id: 'A', text: 'Node A' },
        { id: 'B', text: 'Node B' }
      ]
    };
    aiModel.applyChange(initial);

    // Then replace with new nodes
    const replacement: SimplifiedDiagram = {
      action: 'replace',
      nodes: [{ id: 'C', text: 'Node C' }]
    };
    aiModel.applyChange(replacement);

    const diagram = aiModel['diagram'];
    const nodes = Array.from(diagram.nodeLookup.values());
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.getText()).toBe('Node C');
  });
});
