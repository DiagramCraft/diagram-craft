import { $cmp, Component } from '../component/component';
import { rawHTML, VNode } from '../component/vdom';
import * as svg from '../component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { Angle } from '@diagram-craft/geometry/angle';
import { Diagram } from '@diagram-craft/model/diagram';
import { FillType, type NodeProps } from '@diagram-craft/model/diagramProps';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { DeepRequired } from '@diagram-craft/utils/types';

const getPatternProps = (fill: NodePropsForRendering['fill'], bounds: Omit<Box, 'r'>) => {
  if (fill.image) {
    if (fill.image.fit === 'fill') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'objectBoundingBox',
        imgWith: 1,
        imgHeight: 1,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (fill.image.fit === 'keep') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: fill.image.w,
        imgHeight: fill.image.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (fill.image.fit === 'contain') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid meet'
      };
    } else if (fill.image.fit === 'cover') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (fill.image.fit === 'tile') {
      return {
        patternUnits: 'userSpaceOnUse',
        width: Math.max(1, fill.image.w * fill.image.scale),
        height: Math.max(1, fill.image.h * fill.image.scale),
        patternContentUnits: 'userSpaceOnUse',
        imgWith: Math.max(1, fill.image.w * fill.image.scale),
        imgHeight: Math.max(1, fill.image.h * fill.image.scale),
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
  fill: NodePropsForRendering['fill'];
};

export class PatternFillColorAdjustment extends Component<FillProps> {
  render(props: FillProps) {
    const fill = props.fill;
    const filterChildren: VNode[] = [];

    if (fill.image.tint !== '') {
      filterChildren.push(
        svg.feFlood({
          'result': 'fill',
          'width': '100%',
          'height': '100%',
          'flood-color': fill.image.tint,
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
          k2: fill.image.tintStrength,
          k3: (1 - fill.image.tintStrength).toString()
        })
      );
    }

    if (fill.image.saturation !== 1) {
      filterChildren.push(
        svg.feColorMatrix({
          type: 'saturate',
          values: fill.image.saturation?.toString()
        })
      );
    }

    if (fill.image.brightness !== 1) {
      filterChildren.push(
        svg.feComponentTransfer(
          {},
          svg.feFuncR({ type: 'linear', slope: fill.image.brightness }),
          svg.feFuncG({ type: 'linear', slope: fill.image.brightness }),
          svg.feFuncB({ type: 'linear', slope: fill.image.brightness })
        )
      );
    }

    if (fill.image.contrast !== 1) {
      filterChildren.push(
        svg.feComponentTransfer(
          {},
          svg.feFuncR({
            type: 'linear',
            slope: fill.image.contrast,
            intercept: -(0.5 * fill.image.contrast) + 0.5
          }),
          svg.feFuncG({
            type: 'linear',
            slope: fill.image.contrast,
            intercept: -(0.5 * fill.image.contrast) + 0.5
          }),
          svg.feFuncB({
            type: 'linear',
            slope: fill.image.contrast,
            intercept: -(0.5 * fill.image.contrast) + 0.5
          })
        )
      );
    }
    return svg.filter({ id: `${props.patternId}-filter` }, ...filterChildren);
  }
}

type FillPatternProps = {
  patternId: string;
  fill: NodePropsForRendering['fill'];
  bounds: Omit<Box, 'r'>;
  diagram: Diagram;
};

export class FillPattern extends Component<FillPatternProps> {
  pattern: string = '';

  setPattern = (pattern: string) => {
    this.pattern = pattern;
    this.redraw();
  };

  render(props: FillPatternProps) {
    const fill = props.fill;

    const patternProps = getPatternProps(fill, props.bounds);

    let imageUrl = '';
    if (fill.type === 'image' || fill.type === 'texture') {
      if (fill.image.url && fill.image.url !== '') {
        imageUrl = fill.image.url;
      } else {
        const att = props.diagram.document.attachments.getAttachment(fill.image.id);
        imageUrl = att?.url ?? '';
      }
    } else if (fill.type === 'pattern' && fill.pattern !== '') {
      props.diagram.document.attachments
        .getAttachment(fill.pattern)!
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
            .replaceAll('#BG#', fill.color)
            .replaceAll('#FG#', fill.color2)
        )
      );
    }

    const filterNeeded =
      fill.image.tint !== '' ||
      fill.image.saturation !== 1 ||
      fill.image.brightness !== 1 ||
      fill.image.contrast !== 1;

    const patternChildren: VNode[] = [];

    patternChildren.push(
      svg.rect({
        width: patternProps.imgWith.toString(),
        height: patternProps.imgHeight.toString(),
        fill: fill.color
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
  fill: {
    color: string;
    color2: string;
    gradient: {
      direction: number;
    };
  }
) => {
  return svg.linearGradient(
    {
      id: gradientId,
      gradientTransform: `rotate(${Angle.toDeg(fill.gradient.direction)} 0.5 0.5)`
    },
    svg.stop({
      'offset': '0%',
      'stop-color': fill.color
    }),
    svg.stop({
      'offset': '100%',
      'stop-color': fill.color2
    })
  );
};

export const makeRadialGradient = (gradientId: string, fill: NodePropsForRendering['fill']) => {
  return svg.radialGradient(
    {
      id: gradientId,
      gradientTransform: `rotate(${Angle.toDeg(fill.gradient.direction)} 0.5 0.5)`
    },
    svg.stop({
      'offset': '0%',
      'stop-color': fill.color
    }),
    svg.stop({
      'offset': '100%',
      'stop-color': fill.color2
    })
  );
};

export const addFillComponents = (
  type: 'diagram' | 'node',
  id: string,
  fillType: FillType,
  fill: DeepRequired<NodeProps>['fill'],
  diagram: Diagram,
  bounds: Omit<Box, 'r'>,
  style: Partial<CSSStyleDeclaration> = {},
  children: VNode[],
  cmp: Component<unknown>
) => {
  if (fillType === 'gradient') {
    const gradientId = `node-${id}-gradient`;
    style.fill = `url(#${gradientId})`;

    /* For a gradient we need to add its definition */
    switch (fill.gradient.type ?? 'linear') {
      case 'linear':
        children.push(makeLinearGradient(gradientId, fill));
        break;
      case 'radial':
        children.push(makeRadialGradient(gradientId, fill));
        break;
      default:
        VERIFY_NOT_REACHED();
    }
  } else if (fillType === 'pattern') {
    const patternId = `${type}-${id}-pattern`;
    style.fill = `url(#${patternId})`;

    /* An image based fill has both color adjustments and the fill itself */
    children.push(
      cmp.subComponent($cmp(PatternFillColorAdjustment), {
        patternId,
        fill
      })
    );
    children.push(
      cmp.subComponent($cmp(FillPattern), {
        patternId,
        fill,
        bounds,
        diagram
      })
    );
  } else if (fillType === 'image' || fillType === 'texture') {
    const patternId = `${type}-${id}-pattern`;
    style.fill = `url(#${patternId})`;

    /* An image based fill has both color adjustments and the fill itself */
    children.push(
      cmp.subComponent($cmp(PatternFillColorAdjustment), {
        patternId,
        fill
      })
    );
    children.push(
      cmp.subComponent($cmp(FillPattern), {
        patternId,
        fill,
        bounds,
        diagram
      })
    );
  }
};
