import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { RoundedRectComponent } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';

export class AndroidRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.rect', RoundedRectComponent);
  }
}
