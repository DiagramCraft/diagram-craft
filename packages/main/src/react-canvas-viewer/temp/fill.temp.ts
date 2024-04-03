import { Component } from '../../base-ui/component.ts';
import { r, s, VNode } from '../../base-ui/vdom.ts';
import { DeepReadonly, DeepRequired } from '../../utils/types.ts';
import { getPatternProps } from '../NodePattern.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';

type FillProps = {
  patternId: string;
  nodeProps: DeepRequired<DeepReadonly<NodeProps>>;
};

export class FillFilter extends Component<FillProps> {
  render(props: FillProps) {
    const nodeProps = props.nodeProps;
    const filterChildren: VNode[] = [];

    if (nodeProps.fill.image.tint !== '') {
      filterChildren.push(
        s('feFlood', {
          attrs: {
            'result': 'fill',
            'width': '100%',
            'height': '100%',
            'flood-color': nodeProps.fill.image.tint,
            'flood-opacity': '1'
          }
        })
      );
      filterChildren.push(
        s('feColorMatrix', {
          attrs: {
            in: 'SourceGraphic',
            result: 'desaturate',
            type: 'saturate',
            values: '0'
          }
        })
      );
      filterChildren.push(
        s('feBlend', {
          attrs: {
            in2: 'desaturate',
            in: 'fill',
            mode: 'color',
            result: 'blend'
          }
        })
      );
      filterChildren.push(
        s('feComposite', {
          attrs: {
            in: 'blend',
            in2: 'SourceGraphic',
            operator: 'arithmetic',
            k1: '0',
            k4: '0',
            k2: nodeProps.fill.image.tintStrength,
            k3: (1 - nodeProps.fill.image.tintStrength).toString()
          }
        })
      );
    }

    if (nodeProps.fill.image.saturation !== 1) {
      filterChildren.push(
        s('feColorMatrix', {
          attrs: {
            type: 'saturate',
            values: nodeProps.fill.image.saturation?.toString()
          }
        })
      );
    }

    if (nodeProps.fill.image.brightness !== 1) {
      filterChildren.push(
        s(
          'feComponentTransfer',
          {},
          s('feFuncR', { attrs: { type: 'linear', slope: nodeProps.fill.image.brightness } }),
          s('feFuncG', { attrs: { type: 'linear', slope: nodeProps.fill.image.brightness } }),
          s('feFuncB', { attrs: { type: 'linear', slope: nodeProps.fill.image.brightness } })
        )
      );
    }

    if (nodeProps.fill.image.contrast !== 1) {
      filterChildren.push(
        s(
          'feComponentTransfer',
          {},
          s('feFuncR', {
            attrs: {
              type: 'linear',
              slope: nodeProps.fill.image.contrast,
              intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
            }
          }),
          s('feFuncG', {
            attrs: {
              type: 'linear',
              slope: nodeProps.fill.image.contrast,
              intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
            }
          }),
          s('feFuncB', {
            attrs: {
              type: 'linear',
              slope: nodeProps.fill.image.contrast,
              intercept: -(0.5 * nodeProps.fill.image.contrast) + 0.5
            }
          })
        )
      );
    }
    return s('filter', { attrs: { id: `${props.patternId}-filter` } }, ...filterChildren);
  }
}

type FillPatternProps = {
  def: DiagramNode;
  patternId: string;
  nodeProps: DeepRequired<DeepReadonly<NodeProps>>;
};

export class FillPattern extends Component<FillPatternProps> {
  pattern: string = '';
  private currentProps: FillPatternProps | undefined;

  setPattern = (pattern: string) => {
    this.pattern = pattern;
    this.update(this.currentProps!);
  };

  render(props: FillPatternProps) {
    this.currentProps = props;

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

      if (this.pattern === '') return s('defs', {});

      return s(
        'defs',
        {},
        r(
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
      s('rect', {
        attrs: {
          width: patternProps.imgWith.toString(),
          height: patternProps.imgHeight.toString(),
          fill: nodeProps.fill.color
        }
      })
    );

    if (imageUrl !== '') {
      patternChildren.push(
        s('image', {
          attrs: {
            href: imageUrl,
            preserveAspectRatio: patternProps.preserveAspectRatio,
            width: patternProps.imgWith.toString(),
            height: patternProps.imgHeight.toString(),
            filter: filterNeeded ? `url(#${props.patternId}-filter)` : ''
          }
        })
      );
    }

    return s(
      'defs',
      {},
      s(
        'pattern',
        {
          attrs: {
            id: props.patternId,
            patternUnits: patternProps.patternUnits,
            patternContentUnits: patternProps.patternContentUnits,
            width: patternProps.width,
            height: patternProps.height
          }
        },
        ...patternChildren
      )
    );
  }
}
