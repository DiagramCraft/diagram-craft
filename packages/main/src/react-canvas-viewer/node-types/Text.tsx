import { useCallback } from 'react';
import { TextPart } from '../TextPart.tsx';
import { propsUtils } from '../utils/propsUtils.ts';
import { Extent } from '../../geometry/extent.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { RectNodeDefinition } from './Rect.nodeType.ts';

export const Text = (props: Props) => {
  const sizeChangeCallback = useCallback(
    (size: Extent) => {
      const height = size.h;
      const width = size.w;

      UnitOfWork.execute(props.node.diagram!, uow => {
        props.node.setBounds(
          {
            ...props.node.bounds,
            h: height,
            w: width
          },
          uow
        );
      });

      props.node.diagram!.selectionState.rebaseline();
    },
    [props.node]
  );

  return (
    <>
      <rect
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        className={'svg-node svg-node__boundary'}
        {...propsUtils.filterSvgProperties(props)}
      />
      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={TextPart.defaultOnChange(props.node)}
        onSizeChange={sizeChangeCallback}
        onMouseDown={props.onMouseDown!}
      />
    </>
  );
};

export class TextNodeDefinition extends RectNodeDefinition {
  constructor() {
    super('text', 'Test');
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      style: 'default-text',

      // TODO: Remove all of this
      stroke: {
        enabled: false
      },
      fill: {
        enabled: false
      },
      text: {
        align: 'left',
        text: 'Text',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    };
  }

  getInitialConfig(): { size: Extent } {
    return { size: { w: 100, h: 10 } };
  }
}

type Props = ReactNodeProps<SVGRectElement>;
