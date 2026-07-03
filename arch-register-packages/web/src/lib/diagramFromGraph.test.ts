import { describe, expect, it } from 'vitest';
import type {
  SerializedDiagramDocument,
  SerializedRegularEdge,
  SerializedRegularElement,
  SerializedRegularNode
} from '@diagram-craft/model/serialization/serializedTypes';
import { createDiagramFromGraph } from './diagramFromGraph';

const getElements = (diagram: SerializedDiagramDocument): readonly SerializedRegularElement[] => {
  const layer = diagram.diagrams[0]?.layers[0];
  return layer?.type === 'layer' && layer.layerType === 'regular' ? layer.elements : [];
};

const getCanvasBottom = (diagram: SerializedDiagramDocument) => {
  const canvas = diagram.diagrams[0]?.canvas;
  return (canvas?.y ?? 0) + (canvas?.h ?? 0);
};

const isEdge = (element: SerializedRegularElement): element is SerializedRegularEdge =>
  element.type === 'edge';

const isNode = (element: SerializedRegularElement): element is SerializedRegularNode =>
  element.type === 'node';

describe('createDiagramFromGraph', () => {
  it('extends hierarchy canvas bounds to include reference arcs and labels', () => {
    const diagram = createDiagramFromGraph(
      'Hierarchy',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' }
      ],
      [{ id: 'ref', from: 'a', to: 'b', kind: 'reference', label: 'depends on' }],
      { layout: 'hierarchy', nodeWidth: 160, nodeHeight: 48 }
    );

    const edge = getElements(diagram).find(
      (element): element is SerializedRegularEdge => isEdge(element) && element.id === 'ref'
    );

    expect(edge).toBeDefined();
    if (!edge || edge.type !== 'edge') return;

    const waypointBottom = edge.waypoints?.[0]?.point.y ?? 0;
    const label = edge.children?.find(isNode);
    const labelBottom = label?.bounds.y ?? 0;
    const labelHeight = label?.bounds.h ?? 0;
    expect(getCanvasBottom(diagram)).toBeGreaterThanOrEqual(
      Math.max(waypointBottom, labelBottom + labelHeight) + 60
    );
  });

  it('extends canvas bounds to include self-loop geometry and labels', () => {
    const diagram = createDiagramFromGraph(
      'Self loop',
      [{ id: 'a', label: 'A' }],
      [{ id: 'loop', from: 'a', to: 'a', label: 'self' }],
      { layout: 'layered', nodeWidth: 160, nodeHeight: 48 }
    );

    const edge = getElements(diagram).find(
      (element): element is SerializedRegularEdge => isEdge(element) && element.id === 'loop'
    );

    expect(edge).toBeDefined();
    if (!edge || edge.type !== 'edge') return;

    const waypoint = edge.waypoints?.[0]?.point;
    const label = edge.children?.find(isNode);

    expect(waypoint).toBeDefined();
    expect(label).toBeDefined();
    expect(getCanvasBottom(diagram)).toBeGreaterThanOrEqual(
      Math.max(waypoint?.y ?? 0, (label?.bounds.y ?? 0) + (label?.bounds.h ?? 0)) + 60
    );
  });

  it('skips edges whose endpoints are missing from the input nodes', () => {
    const diagram = createDiagramFromGraph(
      'Invalid edge',
      [{ id: 'a', label: 'A' }],
      [{ id: 'missing', from: 'a', to: 'ghost' }],
      { layout: 'layered' }
    );

    const elements = getElements(diagram);

    expect(elements.filter(isNode)).toHaveLength(1);
    expect(elements.some(element => isEdge(element) && element.id === 'missing')).toBe(false);
  });

  it('uses a deterministic root for tree layout regardless of input node order', () => {
    const edges = [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'ac', from: 'a', to: 'c' }
    ];

    const first = createDiagramFromGraph(
      'Tree',
      [
        { id: 'b', label: 'B' },
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' }
      ],
      edges,
      { layout: 'tree' }
    );
    const second = createDiagramFromGraph(
      'Tree',
      [
        { id: 'c', label: 'C' },
        { id: 'b', label: 'B' },
        { id: 'a', label: 'A' }
      ],
      edges,
      { layout: 'tree' }
    );

    const nodeBounds = (diagram: SerializedDiagramDocument) =>
      Object.fromEntries(
        getElements(diagram)
          .filter(isNode)
          .map(element => [element.id, element.bounds])
          .sort(([left], [right]) => (left as string).localeCompare(right as string))
      );

    expect(nodeBounds(first)).toEqual(nodeBounds(second));
  });
});
