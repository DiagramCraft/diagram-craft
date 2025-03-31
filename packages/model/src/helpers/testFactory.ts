import { Diagram, DocumentBuilder } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge, ResolvedLabelNode } from '../diagramEdge';
import { FreeEndpoint } from '../endpoint';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../elementDefinitionRegistry';
import { DiagramDocument } from '../diagramDocument';
import { _p } from '@diagram-craft/geometry/point';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { newid } from '@diagram-craft/utils/id';

const createNode = (diagram: Diagram) =>
  new DiagramNode(
    newid(),
    'rect',
    {
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      r: 0
    },
    diagram,
    diagram.activeLayer,
    {},
    {}
  );

const createEdge = (diagram: Diagram) =>
  new DiagramEdge(
    newid(),
    new FreeEndpoint({ x: 0, y: 0 }),
    new FreeEndpoint({ x: 10, y: 10 }),
    {},
    {},
    [],
    diagram,
    diagram.activeLayer
  );

const createDiagram = () => {
  const registry = new NodeDefinitionRegistry();
  registry.register(new RectNodeDefinition('rect', 'Rectangle'));

  const { diagram } = DocumentBuilder.empty(
    '1',
    'test',
    new DiagramDocument(registry, new EdgeDefinitionRegistry())
  );

  return diagram;
};

const createLabelNode = (node: DiagramNode): ResolvedLabelNode => {
  return {
    node,
    type: 'perpendicular',
    offset: _p(0, 0),
    timeOffset: 0,
    id: newid()
  };
};

export const TestFactory = {
  createNode,
  createEdge,
  createDiagram,
  createLabelNode
};
