import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { parseNum } from './utils';
import { DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import { Style, WorkQueue } from './drawioReader';
import { Angle } from '@diagram-craft/geometry/angle';
import { dataURItoBlob } from './blobUtils';
import { HAlign } from '@diagram-craft/model/diagramProps';
import { FullDirection } from '@diagram-craft/geometry/direction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

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
  layer: Layer,
  queue: WorkQueue
) => {
  const defaults = {
    image: {
      margin: 0,
      width: '100%',
      height: '100%',
      imageAlign: 'left',
      imageValign: 'middle',
      textPosition: 'bottom'
    },
    default: {
      margin: 0,
      width: '100%',
      height: '100%',
      imageAlign: 'left',
      imageValign: 'middle',
      textPosition: 'bottom'
    },
    label: {
      margin: 8,
      width: '42',
      height: '42',
      imageAlign: 'left',
      imageValign: 'middle',
      textPosition: 'center'
    },
    icon: {
      margin: 0,
      width: '48',
      height: '48',
      imageAlign: 'center',
      imageValign: 'middle',
      textPosition: 'bottom'
    }
  };

  const image = style.image ?? '';

  props.fill!.type = 'image';
  props.fill!.color = 'transparent';
  props.text!.valign = 'top';
  props.text!.align = 'center';

  props.custom ??= {};
  props.custom.drawioImage ??= {};

  if ('label' in style) {
    props.custom.drawioImage!.textPosition = 'right';
  }

  const isImageShape = style.shape === 'image' || '_image' in style;

  const stylename =
    '_image' in style
      ? 'image'
      : '_label' in style
        ? 'label'
        : '_icon' in style
          ? 'icon'
          : 'default';

  props.custom.drawioImage.stylename = stylename;
  props.custom.drawioImage.imageMargin = defaults[stylename].margin ?? defaults.default.margin;

  props.custom.drawioImage.imageHeight =
    style.imageHeight ?? defaults[stylename].height ?? defaults.default.height;
  props.custom.drawioImage.imageWidth =
    style.imageWidth ?? defaults[stylename].width ?? defaults.default.width;

  props.custom.drawioImage.keepAspect =
    style.imageAspect !== '0' && !style.imageHeight && !style.imageWidth;
  props.custom.drawioImage.flipV = style.imageFlipV === '1';
  props.custom.drawioImage.flipH = style.imageFlipH === '1';

  // TODO: Why is this on the drawio object?
  if (props.custom.drawio?.textPosition === 'right') {
    props.text!.align = 'left';
    props.text!.valign = 'middle';
  }
  // @ts-ignore
  props.custom.drawioImage.textPosition =
    props.custom.drawio?.textPosition ??
    defaults[stylename].textPosition ??
    defaults.default.textPosition;

  if (!style.imageBorder) {
    if (style.strokeColor && !isImageShape) {
      props.stroke!.enabled = true;
      props.stroke!.color = style.strokeColor;
    } else {
      props.stroke!.enabled = false;

      // TODO: Why is this needed
      props.stroke!.color = 'transparent';
      props.stroke!.width = 0;
    }

    if (style.rounded !== '0' && !isImageShape) {
      props.effects ??= {};
      props.effects.rounding = true;
    }
  } else {
    props.stroke!.color = style.imageBorder;
  }

  if (image === 'none') {
    // Do nothing
  } else if (image.startsWith('data:')) {
    const blob = dataURItoBlob(image);
    const attachment = await diagram.document.attachments.addAttachment(blob);

    props.fill!.image = {
      id: attachment.hash,
      fit: 'keep'
    };
  } else {
    props.fill!.image = {
      url: image,
      fit: 'keep'
    };
  }

  props.custom.drawioImage.backgroundColor = style.imageBackground;
  // @ts-ignore
  props.custom.drawioImage.imageAlign =
    style.imageAlign ?? defaults[stylename].imageAlign ?? defaults.default.imageAlign;
  // @ts-ignore
  props.custom.drawioImage.imageValign =
    style.imageVerticalAlign ?? defaults[stylename].imageValign ?? defaults.default.imageValign;

  const node = new DiagramNode(id, 'drawioImage', bounds, diagram, layer, props, metadata, texts);

  // Determine image size
  queue.add(() => {
    if (props.fill?.image?.url) {
      const img = new Image();
      img.onload = () => {
        UnitOfWork.execute(
          diagram,
          uow => {
            node.updateProps(props => {
              if (props.custom!.drawioImage!.imageWidth === '0') {
                props.custom!.drawioImage!.imageWidth = img.width.toString();
              }
              if (props.custom!.drawioImage!.imageHeight === '0') {
                props.custom!.drawioImage!.imageHeight = img.height.toString();
              }

              props.fill!.image!.w = img.width;
              props.fill!.image!.h = img.height;
            }, uow);
          },
          true
        );
      };
      img.src = props.fill!.image!.url!;
    }
  });

  return node;
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
