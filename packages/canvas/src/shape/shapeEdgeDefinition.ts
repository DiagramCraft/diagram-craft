import { AbstractEdgeDefinition } from '@diagram-craft/model/edgeDefinition';
import type { BaseEdgeComponent } from '../components/BaseEdgeComponent';

type EdgeShapeConstructor<T extends ShapeEdgeDefinition = ShapeEdgeDefinition> = {
  new (shapeEdgeDefinition: T): BaseEdgeComponent;
};

export abstract class ShapeEdgeDefinition extends AbstractEdgeDefinition {
  protected constructor(
    name: string,
    type: string,
    public readonly component: EdgeShapeConstructor
  ) {
    super(name, type);
  }
}
