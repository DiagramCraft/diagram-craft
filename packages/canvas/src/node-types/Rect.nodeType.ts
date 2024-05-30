import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent } from '../components/BaseNodeComponent';

export class RectNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'rect', displayName = 'Rectangle') {
    super(name, displayName, RectComponent);
  }
}

class RectComponent extends BaseNodeComponent {}
