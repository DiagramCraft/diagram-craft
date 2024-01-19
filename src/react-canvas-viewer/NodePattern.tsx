import { DeepRequired } from '../utils/types.ts';
import { Box } from '../geometry/box.ts';
import { DiagramNode } from '../model/diagramNode.ts';

const getPatternProps = (nodeProps: DeepRequired<NodeProps>, bounds: Box) => {
  if (nodeProps.fill.image && nodeProps.fill.image.url !== '') {
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

export const NodePattern = (props: Props) => {
  const patternProps = getPatternProps(props.nodeProps, props.def.bounds);

  return (
    <>
      <filter id={`${props.patternId}-filter`}>
        <feFlood
          result="fill"
          width="100%"
          height="100%"
          floodColor={props.nodeProps.fill.image.tint}
          floodOpacity="1"
        />
        <feColorMatrix in="SourceGraphic" result="desaturate" type="saturate" values="0" />
        <feBlend in2="desaturate" in="fill" mode="color" />
      </filter>
      <pattern
        id={props.patternId}
        patternUnits={patternProps.patternUnits}
        patternContentUnits={patternProps.patternContentUnits}
        width={patternProps.width}
        height={patternProps.height}
      >
        <rect
          width={patternProps.imgWith}
          height={patternProps.imgHeight}
          fill={props.nodeProps.fill.color}
        />
        {props.nodeProps.fill.image.url && props.nodeProps.fill.image.url !== '' && (
          <image
            href={props.nodeProps.fill.image.url}
            preserveAspectRatio={patternProps.preserveAspectRatio}
            width={patternProps.imgWith}
            height={patternProps.imgHeight}
            filter={
              props.nodeProps.fill.image.tint === '' ? undefined : `url(#${props.patternId}-filter)`
            }
          />
        )}
      </pattern>
    </>
  );
};

type Props = {
  patternId: string;
  nodeProps: DeepRequired<NodeProps>;
  def: DiagramNode;
};
