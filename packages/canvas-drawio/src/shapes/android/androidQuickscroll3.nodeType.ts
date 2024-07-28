import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

const THUMB = { w: 6, h: 20 };

declare global {
  interface CustomNodeProps {
    androidQuickscroll3?: {
      dy?: number;
    };
  }
}

registerCustomNodeDefaults('androidQuickscroll3', { dy: 0.5 });

export class AndroidQuickscroll3 extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.quickscroll3');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, builder: ShapeBuilder) {
    const { w, h } = props.node.bounds;
    const { dy } = props.nodeProps.custom.androidQuickscroll3;

    const b = builder.buildBoundary();
    b.path(w - THUMB.w / 2, 0).line(w - THUMB.w / 2, h);
    b.stroke({ color: '#cccccc' });

    b.restore();
    b.rect(w - THUMB.w, dy * h - THUMB.h / 2, THUMB.w, THUMB.h, 1, 1);
    b.fillAndStroke();
  }
}
