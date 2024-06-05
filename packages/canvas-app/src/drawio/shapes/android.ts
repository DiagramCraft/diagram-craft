import { loadStencil } from '../stencilLoader';
import { NodeDefinitionRegistry, Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { findStencilByName, stencilNameToType } from './shapeUtils';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import { Box } from '@diagram-craft/geometry/box';
import { Style } from '../drawioReader';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { parseNum } from '../utils';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { text } from '@diagram-craft/canvas/component/vdom';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<Stencil>
) => {
  const stencil = findStencilByName(stencils, name);

  stencil.node.name = name;
  stencil.node.type = 'mxgraph.android.' + stencilNameToType(name);

  registry.register(stencil.node, stencil);
};

class Spinner2NodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.spinner2', 'Android Spinner 2', Spinner2NodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<Spinner2NodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const pb = new PathBuilder();

      const { x, y, w, h } = props.node.bounds;

      pb.moveTo(Point.of(x, y + h));
      pb.lineTo(Point.of(x + w, y + h));

      const k = Math.min(w / 10, h);
      pb.moveTo(Point.of(x + w - k, y + h));
      pb.lineTo(Point.of(x + w, y + h - k));
      pb.lineTo(Point.of(x + w, y + h));
      pb.close();

      shapeBuilder.path(pb.getPaths().all(), props.nodeProps);
      shapeBuilder.text(this);
    }
  };
}

class AndroidRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.rect', 'Android Rect', AndroidRectNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidRectNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = new RoundedRectNodeDefinition()
        .getBoundingPathBuilder(props.node)
        .getPaths();

      shapeBuilder.boundaryPath(boundary.all());
      shapeBuilder.text(this);
    }
  };
}

class AndroidRRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.rrect', 'Android RRect', AndroidRRectNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidRRectNodeDefinition> {};
}

class AndroidCheckboxNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.checkbox', 'Android Checkbox', AndroidCheckboxNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidCheckboxNodeDefinition> {};
}

class AndroidAnchorNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.anchor', 'Android Anchor', AndroidAnchorNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidAnchorNodeDefinition> {
    buildShape(_props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.text(this);
    }
  };
}

class AndroidScrollbars2NodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'mxgraph.android.scrollbars2',
      'Android Scrollbars2',
      AndroidScrollbars2NodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<AndroidScrollbars2NodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const { x, y, w, h } = props.node.bounds;
      const fc = props.nodeProps.fill.color;

      b.add(
        svg.rect({
          x: x + w - 5,
          y: y,
          width: 5,
          height: h - 7,
          fill: fc
        })
      );
      b.add(
        svg.rect({
          x: x,
          y: y + h - 5,
          width: w - 7,
          height: 5,
          fill: fc
        })
      );
    }
  };
}

/* AndroidProgressBarDefinition ************************************************************************* */

type ShapeAndroidProgressBarConfig = {
  width?: number;
  dx1?: number;
  dx2?: number;
};

declare global {
  interface NodeProps {
    shapeAndroidProgressBar?: ShapeAndroidProgressBarConfig;
  }
}

registerNodeDefaults('shapeAndroidProgressBar', { width: 2, dx1: 0.25, dx2: 0.75 });

class AndroidProgressBarDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'mxgraph.android.progressBar',
      'Android Progress Bar',
      AndroidProgressBarDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<AndroidProgressBarDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const { x, y, w } = props.node.bounds;

      const { width, dx1, dx2 } = props.nodeProps.shapeAndroidProgressBar;
      const c = props.node.renderProps.stroke.color;

      const base = {
        'y1': y,
        'y2': y,
        'stroke-width': width,
        'stroke-linecap': 'butt'
      };

      b.add(svg.line({ ...base, x1: x, x2: x + w, stroke: c }));
      b.add(svg.line({ ...base, x1: x + dx2 * w, x2: x + dx1 * w, stroke: 'rgba(0, 0, 0, 0.2)' }));
      b.add(svg.line({ ...base, x1: x + dx1 * w, x2: x + w, stroke: '#444444' }));
    }
  };
}

/* AndroidProgressScrubber ****************************************************************************** */

type ShapeAndroidProgressScrubber = {
  dx?: number;
  state?: 'disabled' | 'focused' | 'pressed';
};

declare global {
  interface NodeProps {
    shapeAndroidProgressScrubber?: ShapeAndroidProgressScrubber;
  }
}

registerNodeDefaults('shapeAndroidProgressScrubber', { dx: 0.5, state: 'disabled' });

class AndroidProgressScrubber extends ShapeNodeDefinition {
  constructor() {
    super(
      'mxgraph.android.progressScrubber',
      'Android Progress Scrubbed',
      AndroidProgressScrubber.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<AndroidProgressScrubber> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const { x, y, w, h } = props.node.bounds;
      const yMid = y + h / 2;

      const { dx, state } = props.nodeProps.shapeAndroidProgressScrubber;
      const c = props.node.renderProps.fill.color;

      b.add(
        svg.line({
          'y1': yMid,
          'y2': yMid,
          'stroke-linecap': 'butt',
          'x1': x,
          'x2': x + w,
          'stroke': '#444444'
        })
      );

      if (state === 'disabled') {
        b.add(svg.circle({ cx: x + dx * w, cy: yMid, r: 10, fill: 'rgba(102, 102, 102, 0.5)' }));
      } else {
        b.add(
          svg.line({
            'x1': x,
            'y1': yMid,
            'x2': x + dx * w,
            'y2': yMid,
            'stroke-linecap': 'butt',
            'stroke': c
          })
        );
        b.add(
          svg.circle({
            cx: x + dx * w,
            cy: yMid,
            r: 10,
            fill: `color-mix(in srgb, ${c}, transparent ${state === 'focused' ? '25%' : '50%'})`
          })
        );

        if (state === 'pressed') {
          b.add(
            svg.circle({
              'cx': x + dx * w,
              'cy': yMid,
              'r': 9.25,
              'fill': 'none',
              'stroke': c,
              'stroke-width': 0.5
            })
          );
        }
      }

      b.add(svg.circle({ cx: x + dx * w, cy: yMid, r: 2, fill: c }));
    }
  };
}

/* AndroidQuickscroll2 ********************************************************************************** */

type ShapeAndroidQuickscroll2 = {
  dy?: number;
};

declare global {
  interface NodeProps {
    shapeAndroidQuickscroll2?: ShapeAndroidQuickscroll2;
  }
}

registerNodeDefaults('shapeAndroidQuickscroll2', { dy: 0.5 });

class AndroidQuickscroll2 extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.quickscroll2', 'Android Quickscroll2', AndroidQuickscroll2.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidQuickscroll2> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const thumb = { w: 6, h: 20 };

      const { x, y, w, h } = props.node.bounds;
      const xMid = x + w - thumb.w / 2;

      const { dy } = props.nodeProps.shapeAndroidQuickscroll2;
      const fc = props.node.renderProps.fill.color;
      const sc = props.node.renderProps.stroke.color;

      b.add(
        svg.line({
          'y1': y,
          'y2': y + h,
          'stroke-linecap': 'butt',
          'x1': xMid,
          'x2': xMid,
          'stroke': '#cccccc'
        })
      );

      b.add(
        svg.rect({
          'x': xMid - thumb.w / 2,
          'y': y + h * dy - thumb.h / 2,
          'rx': 1,
          'ry': 1,
          'width': thumb.w,
          'height': thumb.h,
          'fill': fc,
          'stroke': sc,
          'stroke-width': 1
        })
      );

      b.add(
        svg.rect({
          x: x,
          y: y + h * dy - 20,
          width: w - thumb.w - 15,
          height: 40,
          fill: '#cccccc'
        })
      );
      b.add(
        svg.path({
          'd': `
            M ${x + w - thumb.w - 15} ${y + h * dy - 20} 
            L ${x + w - thumb.w} ${y + h * dy}
            L ${x + w - thumb.w - 15} ${y + h * dy + 20}
          `,
          'fill': '#444444',
          'stroke-width': 0
        })
      );
      b.add(
        svg.text(
          {
            'x': x + (w - thumb.w - 15) / 2,
            'y': y + h * dy + 5,
            'fill': 'black',
            'font-size': 12,
            'font-family': 'Arial',
            'text-anchor': 'middle'
          },
          text('Aa')
        )
      );
    }
  };
}

/* AndroidQuickscroll3 ********************************************************************************** */

type ShapeAndroidQuickscroll3 = {
  dy?: number;
};

declare global {
  interface NodeProps {
    shapeAndroidQuickscroll3?: ShapeAndroidQuickscroll3;
  }
}

registerNodeDefaults('shapeAndroidQuickscroll3', { dy: 0.5 });

class AndroidQuickscroll3 extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.android.quickscroll3', 'Android Quickscroll3', AndroidQuickscroll3.Shape);
  }

  static Shape = class extends BaseNodeComponent<AndroidQuickscroll3> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const thumb = { w: 6, h: 20 };

      const { x, y, w, h } = props.node.bounds;
      const xMid = x + w / 2;

      const { dy } = props.nodeProps.shapeAndroidQuickscroll3;
      const fc = props.node.renderProps.fill.color;
      const sc = props.node.renderProps.stroke.color;

      b.add(
        svg.line({
          'y1': y,
          'y2': y + h,
          'stroke-linecap': 'butt',
          'x1': xMid,
          'x2': xMid,
          'stroke': '#cccccc'
        })
      );

      b.add(
        svg.rect({
          'x': xMid - thumb.w / 2,
          'y': y + h * dy - thumb.h / 2,
          'rx': 1,
          'ry': 1,
          'width': thumb.w,
          'height': thumb.h,
          'fill': fc,
          'stroke': sc,
          'stroke-width': 1
        })
      );
    }
  };
}

/* AndroidIndeterminateSpinner ************************************************************************** */

class AndroidIndeterminateSpinner extends ShapeNodeDefinition {
  constructor() {
    super(
      'mxgraph.android.indeterminateSpinner',
      'Android IndeterminateSpinner',
      AndroidIndeterminateSpinner.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<AndroidIndeterminateSpinner> {
    buildShape(props: BaseShapeBuildShapeProps, b: ShapeBuilder) {
      const { w, h, x, y } = props.node.bounds;

      const pb1 = new PathBuilder();
      pb1.moveTo(Point.of(x + w * 0.5, y + h * 0.1));
      pb1.arcTo(Point.of(x + w * 0.5, y + h * 0.9), w * 0.4, h * 0.4, 0, 0, 0);
      pb1.lineTo(Point.of(x + w * 0.5, y + h));
      pb1.arcTo(Point.of(x + w * 0.5, y), w * 0.5, h * 0.5, 0, 0, 1);
      pb1.close();

      const pb2 = new PathBuilder();
      pb2.moveTo(Point.of(x + w * 0.5, y + h * 0.1));
      pb2.arcTo(Point.of(x + w * 0.5, y + h * 0.9), w * 0.4, h * 0.4, 0, 0, 1);
      pb2.lineTo(Point.of(x + w * 0.5, y + h));
      pb2.arcTo(Point.of(x + w * 0.5, y), w * 0.5, h * 0.5, 0, 0, 0);
      pb2.close();

      // TODO: This needs to be fixed
      b.path(pb1.getPaths().all(), {
        ...props.nodeProps,
        stroke: {
          enabled: false,
          color: 'transparent'
        },
        fill: {
          type: 'solid',
          color: '#aaaaaa',
          color2: '#dddddd',
          gradient: {
            type: 'linear',
            direction: 0
          }
        }
      });
      b.path(pb2.getPaths().all(), {
        ...props.nodeProps,
        stroke: {
          enabled: false,
          color: 'transparent'
        },
        fill: {
          type: 'solid',
          color: 'red',
          color2: '#dddddd',
          gradient: {
            type: 'linear',
            direction: 0
          }
        }
      });
    }
  };
}

export const parseAndroidShapes = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  style: Style,
  diagram: Diagram,
  layer: Layer
): Promise<DiagramNode> => {
  if (style.shape === 'mxgraph.android.progressBar') {
    props.shapeAndroidProgressBar ??= {};
    props.shapeAndroidProgressBar.width = parseNum(style.strokeWidth, 2);
    props.shapeAndroidProgressBar.dx1 = parseNum(style.dx1, 0.25);
    props.shapeAndroidProgressBar.dx2 = parseNum(style.dx2, 0.75);
  } else if (style.shape?.startsWith('mxgraph.android.quickscroll2')) {
    props.shapeAndroidQuickscroll2 ??= {};
    props.shapeAndroidQuickscroll2.dy = parseNum(style.dy, 0.5);
  } else if (style.shape?.startsWith('mxgraph.android.quickscroll3')) {
    props.shapeAndroidQuickscroll3 ??= {};
    props.shapeAndroidQuickscroll3.dy = parseNum(style.dy, 0.5);
  } else if (style.shape?.startsWith('mxgraph.android.progressScrubber')) {
    props.shapeAndroidProgressScrubber ??= {};
    props.shapeAndroidProgressScrubber.dx = parseNum(style.dx, 0.5);
    if (style.shape === 'mxgraph.android.progressScrubberDisabled') {
      props.shapeAndroidProgressScrubber.state = 'disabled';
      style.shape = 'mxgraph.android.progressScrubber';
    } else if (style.shape === 'mxgraph.android.progressScrubberPressed') {
      props.shapeAndroidProgressScrubber.state = 'pressed';
      style.shape = 'mxgraph.android.progressScrubber';
    } else if (style.shape === 'mxgraph.android.progressScrubberFocused') {
      props.shapeAndroidProgressScrubber.state = 'focused';
      style.shape = 'mxgraph.android.progressScrubber';
    }
  }

  return new DiagramNode(id, style.shape!, bounds, diagram, layer, props);
};

export const registerAndroidShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadStencil(
    '/stencils/android/android.xml',
    'Android',
    '#00BEF2',
    'white'
  );

  r.register(new Spinner2NodeDefinition(), { hidden: true });
  r.register(new AndroidRectNodeDefinition(), { hidden: true });
  r.register(new AndroidProgressBarDefinition(), { hidden: true });
  r.register(new AndroidProgressScrubber(), { hidden: true });
  r.register(new AndroidQuickscroll2(), { hidden: true });
  r.register(new AndroidQuickscroll3(), { hidden: true });
  r.register(new AndroidRRectNodeDefinition(), { hidden: true });
  r.register(new AndroidAnchorNodeDefinition(), { hidden: true });
  r.register(new AndroidScrollbars2NodeDefinition(), { hidden: true });
  r.register(new AndroidCheckboxNodeDefinition(), { hidden: true });
  r.register(new AndroidIndeterminateSpinner(), { hidden: true });

  registerStencil(r, 'phone2', stencils);
  registerStencil(r, 'tab2', stencils);
  registerStencil(r, 'action bar', stencils);
  registerStencil(r, 'action bar landscape', stencils);
  //  registerStencil(r, 'rrect', stencils);
  //registerStencil(r, 'checkbox', stencils);
  registerStencil(r, 'contact badge focused', stencils);
  registerStencil(r, 'contact badge normal', stencils);
  registerStencil(r, 'contact badge pressed', stencils);
  registerStencil(r, 'contextual action bar', stencils);
  registerStencil(r, 'contextual action bar white', stencils);
  registerStencil(r, 'contextual action bar landscape', stencils);
  registerStencil(r, 'contextual action bar landscape white', stencils);
  registerStencil(r, 'contextual split action bar', stencils);
  registerStencil(r, 'contextual split action bar white', stencils);
  registerStencil(r, 'contextual split action bar landscape', stencils);
  registerStencil(r, 'contextual split action bar landscape white', stencils);
  registerStencil(r, 'indeterminate progress bar', stencils);
  //registerStencil(r, 'indeterminateSpinner', stencils);
  registerStencil(r, 'keyboard', stencils);
  registerStencil(r, 'navigation bar 1', stencils);
  registerStencil(r, 'navigation bar 1 landscape', stencils);
  registerStencil(r, 'navigation bar 1 vertical', stencils);
  registerStencil(r, 'navigation bar 2', stencils);
  registerStencil(r, 'navigation bar 3', stencils);
  registerStencil(r, 'navigation bar 3 landscape', stencils);
  registerStencil(r, 'navigation bar 4', stencils);
  registerStencil(r, 'navigation bar 5', stencils);
  registerStencil(r, 'navigation bar 5 vertical', stencils);
  registerStencil(r, 'navigation bar 6', stencils);
  registerStencil(r, 'quick contact', stencils);
  //registerStencil(r, 'progressBar', stencils);
  //registerStencil(r, 'progressScrubberDisabled', stencils);
  //registerStencil(r, 'progressScrubberFocused', stencils);
  //registerStencil(r, 'progressScrubberPressed', stencils);
  //registerStencil(r, 'quickscroll2', stencils);
  //registerStencil(r, 'quickscroll3', stencils);
  //registerStencil(r, 'anchor', stencils);
  //registerStencil(r, 'scrollbars2', stencils);
  //registerStencil(r, 'spinner2', stencils);
  //registerStencil(r, 'rect', stencils);
};
