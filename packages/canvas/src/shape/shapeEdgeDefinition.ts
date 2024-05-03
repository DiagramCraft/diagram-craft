import { BaseEdgeDefinition } from '@diagram-craft/model/baseEdgeDefinition';
import { BaseEdgeComponent } from '../components/BaseEdgeComponent';

type EdgeShapeConstructor<T extends ShapeEdgeDefinition = ShapeEdgeDefinition> = {
  new (shapeEdgeDefinition: T): BaseEdgeComponent;
};

export abstract class ShapeEdgeDefinition extends BaseEdgeDefinition {
  protected constructor(
    name: string,
    type: string,
    public readonly component: EdgeShapeConstructor
  ) {
    super(name, type);
  }
}
