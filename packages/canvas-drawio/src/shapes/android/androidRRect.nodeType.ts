import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseNodeComponent } from '@diagram-craft/canvas/components/BaseNodeComponent';

export class AndroidRRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.rrect', class extends BaseNodeComponent {});
  }
}
