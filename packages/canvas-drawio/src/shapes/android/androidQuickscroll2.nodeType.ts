import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

const THUMB = { w: 6, h: 20 };

declare global {
  interface CustomNodeProps {
    androidQuickscroll2?: {
      dy?: number;
    };
  }
}

registerCustomNodeDefaults('androidQuickscroll2', { dy: 0.5 });

export class AndroidQuickscroll2 extends SimpleShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.quickscroll2');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, builder: ShapeBuilder) {
    const { w, h } = props.node.bounds;
    const { dy } = props.nodeProps.custom.androidQuickscroll2;

    const b = builder.buildBoundary();
    b.setStroke({ color: '#cccccc' });
    b.path(w - THUMB.w / 2, 0).line(w - THUMB.w / 2, h);
    b.stroke();

    b.restore();
    b.rect(w - THUMB.w, dy * h - THUMB.h / 2, THUMB.w, THUMB.h, 1, 1);
    b.fillAndStroke();

    b.rect(0, dy * h - THUMB.h, w - 18, 40);
    b.fill({ color: '#cccccc' });

    b.path(w - 18, dy * h - THUMB.h)
      .line(w - THUMB.w, dy * h)
      .line(w - 18, dy * h + THUMB.h)
      .close();
    b.fill({ color: '#666666' });

    b.text((w - 18) * 0.5, dy * h, 'Aa', { size: '12' });
  }
}
