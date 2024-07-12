import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseNodeComponent } from '@diagram-craft/canvas/components/BaseNodeComponent';

export class AndroidCheckboxNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.checkbox', class extends BaseNodeComponent {});
  }
}
