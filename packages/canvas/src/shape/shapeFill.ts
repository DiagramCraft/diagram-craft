import { Component } from '../component/component';
import { rawHTML, VNode } from '../component/vdom';
import * as svg from '../component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { Angle } from '@diagram-craft/geometry/angle';

const getPatternProps = (nodeProps: DeepRequired<DeepReadonly<NodeProps>>, bounds: Box) => {
  if (nodeProps.fill.image) {
    if (nodeProps.fill.image.fit === 'fill') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'objectBoundingBox',
        imgWith: 1,
        imgHeight: 1,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'keep') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: nodeProps.fill.image.w,
        imgHeight: nodeProps.fill.image.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'contain') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid meet'
      };
    } else if (nodeProps.fill.image.fit === 'cover') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'tile') {
      return {
        patternUnits: 'userSpaceOnUse',
        width: Math.max(1, nodeProps.fill.image.w * nodeProps.fill.image.scale),
        height: Math.max(1, nodeProps.fill.image.h * nodeProps.fill.image.scale),
        patternContentUnits: 'userSpaceOnUse',
        imgWith: Math.max(1, nodeProps.fill.image.w * nodeProps.fill.image.scale),
        imgHeight: Math.max(1, nodeProps.fill.image.h * nodeProps.fill.image.scale),
        preserveAspectRatio: 'xMidYMid slice'
      };
    }
  }

  return {
    patternUnits: 'objectBoundingBox',
    width: 1,
    height: 1,
    patternContentUnits: 'objectBoundingBox',
    imgWith: 1,
    imgHeight: 1,
    preserveAspectRatio: 'xMidYMid slice'
  };
};

type FillProps = {
  patternId: string;
  nodeProps: DeepRequired<DeepReadonly<NodeProps>>;
};

export class PatternFillColorAdjustment extends Component<FillProps> {
  render(props: FillProps) {
    const nodeProps = props.nodeProps;
    const filterChildren: VNode[] = [];

    if (nodeProps.fill.image.tint !== '') {
      filterChildren.push(
        svg.feFlood({
          'result': 'fill',
          'width': '100%',
          'height': '100%',
          'flood-color': nodeProps.fill.image.tint,
          'flood-opacity': '1'
        })
      );
      filterChildren.push(
        svg.feColorMatrix({
          in: 'SourceGraphic',
          result: 'desaturate',
          type: 'saturate',
          values: '0'
        })
      );
      filterChildren.push(
        svg.feBlend({
          in2: 'desaturate',
          in: 'fill',
          mode: 'color',
          result: 'blend'
        })
      );
      filterChildren.push(
        svg.feComposite({
          in: 'blend',
          in2: 'SourceGraphic',
          operator: 'arithmetic',
          k1: '0',
          k4: '0',
          k2: nodeProps.fill.image.tintStrength,
          k3: (1 - nodeProps.fill.image.tintStrength).toString()
        })
      );
    }

    if (nodeProps.fill.image.saturation !== 1) {
      filterChildren.push(
        svg.feColorMatrix({
          type: 'saturate',
          values: nodeProps.fill.image.saturation?.toString()
        })
      );
    }

    if (nodeProps.fill.image.brightness !== 1) {
      filterChildren.push(
        svg.feComponentTransfer(
          {},
          svg.feFuncR({ type: 'linear', slope: nodeProps.fill.image.brightness }),
          svg.feFuncG({ type: 'linear', slope: nodeProps.fill.image.brightness }),
          svg.feFuncB({ type: 'linear', slope: nodeProps.fill.image.brightness })
        )
      );
    }

    if (nodeProps.fill.image.contrast !== 1) {
      filterChildren.push(
        svg.feComponentTransfer(
          {},
          svg.feFuncR({
            type: 'linear',
            slope: nodeProps.fill.image.contrast,
            intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
          }),
          svg.feFuncG({
            type: 'linear',
            slope: nodeProps.fill.image.contrast,
            intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
          }),
          svg.feFuncB({
            type: 'linear',
            slope: nodeProps.fill.image.contrast,
            intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
          })
        )
      );
    }
    return svg.filter({ id: `${props.patternId}-filter` }, ...filterChildren);
  }
}

type FillPatternProps = {
  def: DiagramNode;
  patternId: string;
  nodeProps: DeepRequired<DeepReadonly<NodeProps>>;
};

export class FillPattern extends Component<FillPatternProps> {
  pattern: string = '';

  setPattern = (pattern: string) => {
    this.pattern = pattern;
    this.redraw();
  };

  render(props: FillPatternProps) {
    const nodeProps = props.nodeProps;

    const patternProps = getPatternProps(nodeProps, props.def.bounds);

    let imageUrl = '';
    if (nodeProps.fill.type === 'image' || nodeProps.fill.type === 'texture') {
      if (nodeProps.fill.image.url && nodeProps.fill.image.url !== '') {
        imageUrl = nodeProps.fill.image.url;
      } else {
        const att = props.def.diagram.document.attachments.getAttachment(nodeProps.fill.image.id);
        imageUrl = att?.url ?? '';
      }
    } else if (nodeProps.fill.type === 'pattern') {
      props.def.diagram.document.attachments
        .getAttachment(nodeProps.fill.pattern)!
        .content.text()
        .then(t => {
          if (this.pattern !== t) {
            this.setPattern(t);
          }
        });

      if (this.pattern === '') return svg.defs();

      return svg.defs(
        rawHTML(
          this.pattern
            .replace('#ID#', props.patternId)
            .replaceAll('#BG#', nodeProps.fill.color)
            .replaceAll('#FG#', nodeProps.fill.color2)
        )
      );
    }

    const filterNeeded =
      nodeProps.fill.image.tint !== '' ||
      nodeProps.fill.image.saturation !== 1 ||
      nodeProps.fill.image.brightness !== 1 ||
      nodeProps.fill.image.contrast !== 1;

    const patternChildren: VNode[] = [];

    patternChildren.push(
      svg.rect({
        width: patternProps.imgWith.toString(),
        height: patternProps.imgHeight.toString(),
        fill: nodeProps.fill.color
      })
    );

    if (imageUrl !== '') {
      patternChildren.push(
        svg.image({
          href: imageUrl,
          preserveAspectRatio: patternProps.preserveAspectRatio,
          width: patternProps.imgWith.toString(),
          height: patternProps.imgHeight.toString(),
          filter: filterNeeded ? `url(#${props.patternId}-filter)` : ''
        })
      );
    }

    return svg.defs(
      svg.pattern(
        {
          id: props.patternId,
          patternUnits: patternProps.patternUnits,
          patternContentUnits: patternProps.patternContentUnits,
          width: patternProps.width,
          height: patternProps.height
        },
        ...patternChildren
      )
    );
  }
}

export const makeLinearGradient = (
  gradientId: string,
  nodeProps: DeepReadonly<DeepRequired<NodeProps>>
) => {
  return svg.linearGradient(
    {
      id: gradientId,
      gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
    },
    svg.stop({ 'offset': '0%', 'stop-color': nodeProps.fill.color }),
    svg.stop({ 'offset': '100%', 'stop-color': nodeProps.fill.color2 })
  );
};

export const makeRadialGradient = (
  gradientId: string,
  nodeProps: DeepReadonly<DeepRequired<NodeProps>>
) => {
  return svg.radialGradient(
    {
      id: gradientId,
      gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
    },
    svg.stop({ 'offset': '0%', 'stop-color': nodeProps.fill.color }),
    svg.stop({ 'offset': '100%', 'stop-color': nodeProps.fill.color2 })
  );
};
