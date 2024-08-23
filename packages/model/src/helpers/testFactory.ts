import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { DiagramEdge } from '../diagramEdge';
import { FreeEndpoint } from '../endpoint';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../elementDefinitionRegistry';
import { TestNodeDefinition } from '../TestNodeDefinition';
import { DiagramDocument } from '../diagramDocument';
import { RegularLayer } from '../diagramLayer';
import { UnitOfWork } from '../unitOfWork';

const createNode = (diagram: Diagram) =>
  new DiagramNode(
    '1',
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
    '1',
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
  registry.register(new TestNodeDefinition('rect', 'Rectangle'));

  const d = new Diagram('1', 'test', new DiagramDocument(registry, new EdgeDefinitionRegistry()));
  d.layers.add(new RegularLayer('default', 'Default', [], d), UnitOfWork.immediate(d));

  return d;
};

export const TestFactory = {
  createNode,
  createEdge,
  createDiagram
};
