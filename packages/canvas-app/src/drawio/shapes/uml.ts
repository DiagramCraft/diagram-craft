import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { UmlModuleNodeDefinition } from './umlModule';
import { Box } from '@diagram-craft/geometry/box';
import { ShapeParser, Style } from '../drawioReader';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { parseNum } from '../utils';
import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { coalesce } from '@diagram-craft/utils/strings';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { deepClone } from '@diagram-craft/utils/object';
import { DeepWriteable } from '@diagram-craft/utils/types';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

export const parseUMLShapes = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  if (style.shape === 'module' || style.shape === 'component') {
    props.shapeUmlModule = {
      jettyWidth: parseNum(style.jettyWidth, 20),
      jettyHeight: parseNum(style.jettyHeight, 10)
    };
    return new DiagramNode(id, 'module', bounds, diagram, layer, props);
  } else if (style.shape === 'umlLifeline') {
    props.shapeUmlLifeline = {
      participant: style.participant
    };
  }

  return new DiagramNode(id, style.shape!, bounds, diagram, layer, props);
};

class Folder extends SimpleShapeNodeDefinition {
  constructor() {
    super('folder');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;
    const b = shapeBuilder.buildBoundary();

    b.rect(0, 15, w, h - 15);
    b.rect(0, 0, 50, 15);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp);
  }
}

class UmlActor extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlActor');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.ellipse(w / 2, h / 8, w / 4, h / 8);
    b.fillAndStroke();

    b.path(w / 2, h / 4).line(w / 2, (2 * h) / 3);
    b.path(w / 2, h / 3).line(0, h / 3);
    b.path(w / 2, h / 3).line(w, h / 3);
    b.path(w / 2, (2 * h) / 3).line(0, h);
    b.path(w / 2, (2 * h) / 3).line(w, h);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      y: props.node.bounds.y + h
    });
  }
}

class UmlBoundary extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlBoundary');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { x, h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(0, h / 4).line(0, (h * 3) / 4);
    b.path(0, h / 2).line(w / 6, h / 2);
    b.stroke();

    b.ellipse((7 * w) / 12, h / 2, (w * 5) / 12, h / 2);
    b.fillAndStroke();

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      x: x + w / 6,
      w: w - w / 6
    });
  }
}

class UmlEntity extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlEntity');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(w / 8, h).line((w * 7) / 8, h);
    b.ellipse(w / 2, h / 2, w / 2, h / 2);
    b.stroke();

    shapeBuilder.text(props.cmp);
  }
}

class UmlControl extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlControl');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { y, h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path((w * 3) / 8, (h / 8) * 1.1).line((w * 5) / 8, 0);
    b.stroke();

    b.ellipse(w / 2, (9 / 16) * h, w / 2, (h * 7) / 16);
    b.fillAndStroke();

    const fg = shapeBuilder.buildInterior();
    fg.path((w * 3) / 8, (h / 8) * 1.1).line((w * 5) / 8, h / 4);
    fg.stroke();

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      y: y + h / 8,
      h: h - h / 8
    });
  }
}

class ProvidedRequiredInterface extends SimpleShapeNodeDefinition {
  constructor() {
    super('providedRequiredInterface');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const inset = 2 + props.node.renderProps.stroke.width;
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.ellipse(w / 2 - inset, h / 2, w / 2 - inset, h / 2 - inset);
    b.fillAndStroke();

    b.path(w / 2, 0)
      .quad(w, 0, w, h / 2)
      .quad(w, h, w / 2, h);
    b.stroke();
  }
}

class RequiredInterface extends SimpleShapeNodeDefinition {
  constructor() {
    super('requiredInterface');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(0, 0)
      .quad(w, 0, w, h / 2)
      .quad(w, h, 0, h);
    b.stroke();
  }
}

class UmlFrame extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlFrame');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { x, y, h, w } = props.node.bounds;

    const cw = 70;
    const ch = 30;
    const cr = 10;

    const b = shapeBuilder.buildBoundary();

    b.path(0, 0)
      .line(cw, 0)
      .line(cw, Math.max(0, ch - cr * 1.5))
      .line(Math.max(0, cw - cr), ch)
      .line(0, ch)
      .close();
    b.fillAndStroke();

    b.path(cw, 0).line(w, 0).line(w, h).line(0, h).line(0, ch);
    b.stroke();

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      x: x,
      y: y,
      w: cw,
      h: ch
    });
  }
}

class UmlDestroy extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlDestroy');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(w, 0).line(0, h).move(0, 0).line(w, h);
    b.stroke();
  }
}

declare global {
  interface NodeProps {
    shapeUmlLifeline?: {
      participant?: string;
    };
  }
}

registerNodeDefaults('shapeUmlLifeline', { participant: '' });

class UmlLifeline extends SimpleShapeNodeDefinition {
  constructor(private readonly registry: NodeDefinitionRegistry) {
    super('umlLifeline');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    // TODO: This must be read from the file
    const participantHeight = 40;

    const b = shapeBuilder.buildBoundary();
    b.path(w / 2, participantHeight).line(w / 2, h);
    b.stroke({
      ...props.nodeProps.stroke,
      pattern: 'DASHED',
      patternSpacing: 40,
      patternSize: 40
    });

    const participant = coalesce(props.node.renderProps.shapeUmlLifeline?.participant, 'rect')!;

    const shape = this.registry.get(participant)!;
    if (!shape) VERIFY_NOT_REACHED();

    const nodeComponent = (shape as ShapeNodeDefinition).component!;

    const participantProps = deepClone(props.nodeProps) as DeepWriteable<NodePropsForRendering>;
    participantProps.text.text = '';

    const node = new DiagramNode(
      `${props.node.id}-participant`,
      shape.type,
      {
        x: props.node.bounds.x,
        y: props.node.bounds.y,
        w: props.node.bounds.w,
        h: participantHeight,
        r: props.node.bounds.r
      },
      props.node.diagram,
      props.node.layer,
      participantProps
    );

    shapeBuilder.add(
      props.cmp.subComponent(() => new nodeComponent(shape as ShapeNodeDefinition), {
        mode: 'canvas',
        element: node,
        actionMap: props.actionMap,
        onDoubleClick: () => {},
        onMouseDown: () => {},
        applicationTriggers: props.applicationTriggers,
        tool: props.tool
      })
    );

    shapeBuilder.text(props.cmp, '1', props.node.renderProps.text, {
      ...props.node.bounds,
      h: participantHeight
    });
  }
}

export const registerUMLShapes = async (
  r: NodeDefinitionRegistry,
  shapeParser: Record<string, ShapeParser>
) => {
  r.register(new UmlActor());
  r.register(new UmlEntity());
  r.register(new UmlControl());
  r.register(new UmlDestroy());

  r.register(new UmlLifeline(r));
  shapeParser['umlLifeline'] = parseUMLShapes;

  r.register(new UmlBoundary());
  r.register(new UmlFrame());

  r.register(new UmlModuleNodeDefinition());
  shapeParser['module'] = parseUMLShapes;
  shapeParser['component'] = parseUMLShapes;

  r.register(new Folder());
  r.register(new ProvidedRequiredInterface());
  r.register(new RequiredInterface());
};
