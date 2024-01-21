import { DeepRequired } from '../utils/types.ts';
import { Box } from '../geometry/box.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { useEffect, useState } from 'react';

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
  const nodeProps = props.nodeProps;

  const patternProps = getPatternProps(nodeProps, props.def.bounds);
  const [pattern, setPattern] = useState('');

  useEffect(() => {
    if (nodeProps.fill.type !== 'pattern') return;
    props.def.diagram.document.attachments
      .getAttachment(nodeProps.fill.pattern)!
      .content.text()
      .then(t => {
        if (pattern !== t) {
          setPattern(t);
        }
      });
  }, [pattern, props.def, nodeProps]);

  let imageUrl = '';
  if (nodeProps.fill.type === 'image' || nodeProps.fill.type === 'texture') {
    if (nodeProps.fill.image.url && nodeProps.fill.image.url !== '') {
      imageUrl = nodeProps.fill.image.url;
    } else {
      const att = props.def.diagram.document.attachments.getAttachment(nodeProps.fill.image.id);
      imageUrl = att?.url ?? '';
    }
  }

  if (nodeProps.fill.type === 'pattern') {
    return (
      <>
        <defs
          dangerouslySetInnerHTML={{
            __html: pattern
              .replace('#ID#', props.patternId)
              .replaceAll('#BG#', nodeProps.fill.color)
              .replaceAll('#FG#', nodeProps.fill.color2)
          }}
        ></defs>
      </>
    );
  }

  const filterNeeded =
    nodeProps.fill.image.tint !== '' ||
    nodeProps.fill.image.saturation !== 1 ||
    nodeProps.fill.image.brightness !== 1 ||
    nodeProps.fill.image.contrast !== 1;

  return (
    <>
      <filter id={`${props.patternId}-filter`}>
        {nodeProps.fill.image.tint !== '' && (
          <>
            <feFlood
              result="fill"
              width="100%"
              height="100%"
              floodColor={nodeProps.fill.image.tint}
              floodOpacity="1"
            />
            <feColorMatrix in="SourceGraphic" result="desaturate" type="saturate" values={'0'} />
            <feBlend in2="desaturate" in="fill" mode="color" result="blend" />

            <feComposite
              in="blend"
              in2="SourceGraphic"
              operator="arithmetic"
              k1="0"
              k4="0"
              k2={nodeProps.fill.image.tintStrength}
              k3={(1 - nodeProps.fill.image.tintStrength).toString()}
            />
          </>
        )}

        {nodeProps.fill.image.saturation !== 1 && (
          <feColorMatrix type="saturate" values={nodeProps.fill.image.saturation?.toString()} />
        )}

        {nodeProps.fill.image.brightness !== 1 && (
          <feComponentTransfer>
            <feFuncR type="linear" slope={nodeProps.fill.image.brightness} />
            <feFuncG type="linear" slope={nodeProps.fill.image.brightness} />
            <feFuncB type="linear" slope={nodeProps.fill.image.brightness} />
          </feComponentTransfer>
        )}

        {nodeProps.fill.image.contrast !== 1 && (
          <feComponentTransfer>
            <feFuncR
              type="linear"
              slope={nodeProps.fill.image.contrast}
              intercept={-(0.5 * nodeProps.fill.image.contrast) + 0.5}
            />
            <feFuncG
              type="linear"
              slope={nodeProps.fill.image.contrast}
              intercept={-(0.5 * nodeProps.fill.image.contrast) + 0.5}
            />
            <feFuncB
              type="linear"
              slope={nodeProps.fill.image.contrast}
              intercept={-(0.5 * nodeProps.fill.image.contrast) + 0.5}
            />
          </feComponentTransfer>
        )}
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
          fill={nodeProps.fill.color}
        />
        {imageUrl !== '' && (
          <image
            href={imageUrl}
            preserveAspectRatio={patternProps.preserveAspectRatio}
            width={patternProps.imgWith}
            height={patternProps.imgHeight}
            filter={filterNeeded ? `url(#${props.patternId}-filter)` : undefined}
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
