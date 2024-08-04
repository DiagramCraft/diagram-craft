import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { parseNum } from './utils';
import { DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import { Style } from './drawioReader';
import { Angle } from '@diagram-craft/geometry/angle';
import { dataURItoBlob } from './blobUtils';
import { HAlign } from '@diagram-craft/model/diagramProps';
import { FullDirection } from '@diagram-craft/geometry/direction';

const makeShape = (
  type: string,
  setProps: (s: Style, p: NodeProps & { custom: CustomNodeProps }) => void = () => {}
) => {
  return async (
    id: string,
    bounds: Box,
    props: NodeProps,
    metadata: ElementMetadata,
    texts: NodeTexts,
    style: Style,
    diagram: Diagram,
    layer: Layer
  ) => {
    props.custom ??= {};
    setProps(style, props as NodeProps & { custom: CustomNodeProps });
    return new DiagramNode(id, type, bounds, diagram, layer, props, metadata, texts);
  };
};

export const parseHexagon = makeShape('hexagon', (style, props) => {
  props.custom.hexagon = {
    size: parseNum(style.size, 50) / 2
  };
});

export const parseStep = makeShape('step', (style, props) => {
  props.custom.step = {
    size: parseNum(style.size, 25)
  };
});

export const parsePartialRect = makeShape('partial-rect', (style, props) => {
  props.custom.partialRect = {
    north: style.top !== '0',
    south: style.bottom !== '0',
    east: style.right !== '0',
    west: style.left !== '0'
  };
});

export const parseRect = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  if (style.rounded === '1')
    return parseRoundedRect(id, bounds, props, metadata, texts, style, diagram, layer);
  return new DiagramNode(id, 'rect', bounds, diagram, layer, props, metadata, texts);
};

export const parseCube = makeShape('cube');

export const parseTransparent = makeShape('transparent', (style, props) => {
  props.text!.valign = 'middle';
  // @ts-ignore
  props.text!.align = style.align ?? 'center';
});

export const parseLine = makeShape('line');

export const parseDelay = makeShape('delay');

export const parseCloud = makeShape('cloud');

export const parseTable = makeShape('table', (style, props) => {
  props.custom.table = {
    gap: 0,
    title: 'startSize' in style,
    titleSize: parseNum(style.startSize, 0)
  };
});

export const parseSwimlane = makeShape('swimlane', (style, props) => {
  props.custom.swimlane = {
    title: true,
    titleBorder: true,
    titleSize: parseNum(style.startSize, 20),
    horizontalBorder: false
  };
});

export const parseTableRow = makeShape('tableRow');

export const parseRhombus = makeShape('diamond');

export const parseParallelogram = makeShape('parallelogram', (style, props) => {
  props.custom.parallelogram = {
    slant: parseNum(style.size, 20)
  };
});

export const parseCylinder = makeShape('cylinder', (style, props) => {
  const directionMap = {
    south: 'east',
    north: 'west',
    east: 'north',
    west: 'south'
  };

  props.custom.cylinder = {
    size: parseNum(style.size, 8) * 2,
    direction: (directionMap[style.direction! as keyof typeof directionMap] ?? 'north') as
      | 'east'
      | 'north'
      | 'south'
      | 'west'
  };
});

export const parseProcess = makeShape('process', (style, props) => {
  props.custom.process = {
    size: parseNum(style.size, 0.125) * 100
  };
});

export const parseCurlyBracket = makeShape('curlyBracket', (style, props) => {
  props.custom.curlyBracket = {
    size: parseNum(style.size, 0.5) * 100
  };
});

export const parseBlockArc = makeShape('blockArc', (style, props) => {
  props.custom.blockArc = {
    innerRadius: 100 - parseNum(style.arcWidth, 0.5) * 100,
    startAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - parseNum(style.endAngle, 0.5))),
    endAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - parseNum(style.startAngle, 0.3)))
  };

  if (props.custom.blockArc.endAngle === 0) {
    props.custom.blockArc.endAngle = 359.999;
  }
});

export const parseTriangle = makeShape('triangle', (style, props) => {
  props.custom.triangle = {
    direction: (style.direction ?? 'east') as FullDirection
  };
});

export const parseEllipse = makeShape('circle', (style, props) => {
  props.text!.align = (style.align ?? 'center') as HAlign;
});

export const parseDiamond = makeShape('diamond');

export const parseArrow = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  let type = 'arrow-right';
  if (style.direction === 'north') {
    type = 'arrow-up';
  } else if (style.direction === 'south') {
    type = 'arrow-down';
  }

  props.custom ??= {};
  props.custom.arrow = {};
  props.custom.arrow.notch = parseNum(style.notch, 0);
  props.custom.arrow.y = parseNum(style.dy, 0.2) * 50;
  props.custom.arrow.x = parseNum(style.dx, 20);

  return new DiagramNode(id, type, bounds, diagram, layer, props, metadata, texts);
};

export const parseImage = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  const image = style.image ?? '';

  props.fill!.type = 'image';
  props.fill!.color = 'transparent';
  props.text!.valign = 'top';
  props.text!.align = 'center';

  props.custom ??= {};
  props.custom.drawio ??= {};

  if ('label' in style) {
    props.custom.drawio!.textPosition = 'right';
  }

  props.custom.drawio.imageHeight = parseNum(style.imageHeight, 0);
  props.custom.drawio.imageWidth = parseNum(style.imageWidth, 0);

  if (props.custom.drawio.textPosition === 'right') {
    props.text!.align = 'left';
    props.text!.valign = 'middle';
  }

  if (!style.imageBorder) {
    props.stroke!.enabled = false;
  } else {
    props.stroke!.color = style.imageBorder;
  }

  if (image.startsWith('data:')) {
    const blob = dataURItoBlob(image);
    const attachment = await diagram.document.attachments.addAttachment(blob);

    props.fill!.image = {
      id: attachment.hash,
      fit: 'contain'
    };
  } else {
    props.fill!.image = {
      url: image,
      fit: 'contain'
    };
  }

  return new DiagramNode(id, 'drawioImage', bounds, diagram, layer, props, metadata, texts);
};

export const parseRoundedRect = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: Style,
  diagram: Diagram,
  layer: Layer
) => {
  props.custom ??= {};
  props.custom.roundedRect = {
    radius:
      style.absoluteArcSize === '1'
        ? Math.min(bounds.w / 2, bounds.h / 2, parseNum(style.arcSize, 10) / 2)
        : (parseNum(style.arcSize, 10) * Math.min(bounds.w, bounds.h)) / 100
  };
  return new DiagramNode(id, 'rounded-rect', bounds, diagram, layer, props, metadata, texts);
};
