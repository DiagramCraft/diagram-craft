import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { parseNum } from './utils';
import { DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import { WorkQueue } from './drawioReader';
import { Angle } from '@diagram-craft/geometry/angle';
import { dataURItoBlob } from './blobUtils';
import { HAlign } from '@diagram-craft/model/diagramProps';
import { FullDirection } from '@diagram-craft/geometry/direction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { StyleManager } from './styleManager';

const makeShape = (
  type: string,
  setProps: (s: StyleManager, p: NodeProps & { custom: CustomNodeProps }) => void = () => {}
) => {
  return async (
    id: string,
    bounds: Box,
    props: NodeProps,
    metadata: ElementMetadata,
    texts: NodeTexts,
    style: StyleManager,
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
    size: parseNum(style.get('size'), 50) / 2
  };
});

export const parseStep = makeShape('step', (style, props) => {
  props.custom.step = {
    size: parseNum(style.get('size'), 25)
  };
});

export const parsePartialRect = makeShape('partial-rect', (style, props) => {
  props.custom.partialRect = {
    north: style.get('top') !== '0',
    south: style.get('bottom') !== '0',
    east: style.get('right') !== '0',
    west: style.get('left') !== '0'
  };
});

export const parseRect = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  diagram: Diagram,
  layer: Layer
) => {
  if (style.get('rounded') === '1')
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
    title: style.has('startSize'),
    titleSize: parseNum(style.get('startSize'), 0)
  };
});

export const parseSwimlane = makeShape('swimlane', (style, props) => {
  props.custom.swimlane = {
    title: true,
    titleBorder: true,
    titleSize: parseNum(style.get('startSize'), 20),
    horizontalBorder: false
  };
});

export const parseTableRow = makeShape('tableRow');

export const parseRhombus = makeShape('diamond');

export const parseParallelogram = makeShape('parallelogram', (style, props) => {
  props.custom.parallelogram = {
    slant: parseNum(style.get('size'), 20)
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
    size: parseNum(style.get('size'), 8) * 2,
    direction: (directionMap[style.get('direction')! as keyof typeof directionMap] ?? 'north') as
      | 'east'
      | 'north'
      | 'south'
      | 'west'
  };
});

export const parseProcess = makeShape('process', (style, props) => {
  props.custom.process = {
    size: parseNum(style.get('size'), 0.125) * 100
  };
});

export const parseCurlyBracket = makeShape('curlyBracket', (style, props) => {
  props.custom.curlyBracket = {
    size: parseNum(style.get('size'), 0.5) * 100
  };
});

export const parseBlockArc = makeShape('blockArc', (style, props) => {
  props.custom.blockArc = {
    innerRadius: 100 - parseNum(style.get('arcWidth'), 0.5) * 100,
    startAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - parseNum(style.get('endAngle'), 0.5))),
    endAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - parseNum(style.get('startAngle'), 0.3)))
  };

  if (props.custom.blockArc.endAngle === 0) {
    props.custom.blockArc.endAngle = 359.999;
  }
});

export const parseTriangle = makeShape('triangle', (style, props) => {
  props.custom.triangle = {
    direction: (style.get('direction') ?? 'east') as FullDirection
  };
});

export const parseEllipse = makeShape('circle', (style, props) => {
  props.text!.align = (style.get('align') ?? 'center') as HAlign;
});

export const parseDiamond = makeShape('diamond');

export const parseArrow = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  diagram: Diagram,
  layer: Layer
) => {
  let type = 'arrow-right';
  if (style.get('direction') === 'north') {
    type = 'arrow-up';
  } else if (style.get('direction') === 'south') {
    type = 'arrow-down';
  }

  props.custom ??= {};
  props.custom.arrow = {};
  props.custom.arrow.notch = parseNum(style.get('notch'), 0);
  props.custom.arrow.y = parseNum(style.get('dy'), 0.2) * 50;
  props.custom.arrow.x = parseNum(style.get('dx'), 20);

  return new DiagramNode(id, type, bounds, diagram, layer, props, metadata, texts);
};

export const parseImage = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  diagram: Diagram,
  layer: Layer,
  queue: WorkQueue
) => {
  const image = style.get('image') ?? '';

  props.fill!.type = 'image';
  props.fill!.color = 'transparent';
  props.text!.valign = 'top';
  props.text!.align = 'center';

  props.custom ??= {};
  props.custom.drawioImage ??= {};

  if (style.has('label')) {
    props.custom.drawioImage!.textPosition = 'right';
  }

  const isImageShape = style.get('shape') === 'image' || style.has('_image');

  const stylename = style.has('_image')
    ? 'image'
    : style.has('_label')
      ? 'label'
      : style.has('_icon')
        ? 'icon'
        : 'default';

  props.custom.drawioImage.stylename = stylename;
  props.custom.drawioImage.imageMargin = style.get('_margin');

  props.custom.drawioImage.imageHeight = style.get('imageHeight');
  props.custom.drawioImage.imageWidth = style.get('imageWidth');

  props.custom.drawioImage.keepAspect =
    style.get('imageAspect') !== '0' && !style.has('imageHeight') && !style.has('imageWidth');
  props.custom.drawioImage.flipV = style.get('imageFlipV') === '1';
  props.custom.drawioImage.flipH = style.get('imageFlipH') === '1';

  // TODO: Why is this on the drawio object?
  if (props.custom.drawio?.textPosition === 'right') {
    props.text!.align = 'left';
    props.text!.valign = 'middle';
  }
  // @ts-ignore
  props.custom.drawioImage.textPosition =
    props.custom.drawio?.textPosition ?? style.get('_textPosition');

  if (!style.get('imageBorder')) {
    if (style.get('strokeColor') && !isImageShape) {
      props.stroke!.enabled = true;
      props.stroke!.color = style.get('strokeColor');
    } else {
      props.stroke!.enabled = false;

      // TODO: Why is this needed
      props.stroke!.color = 'transparent';
      props.stroke!.width = 0;
    }

    if (style.get('rounded') !== '0' && !isImageShape) {
      props.effects ??= {};
      props.effects.rounding = true;
    }
  } else {
    props.stroke!.color = style.get('imageBorder');
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

  props.custom.drawioImage.backgroundColor = style.get('imageBackground');
  // @ts-ignore
  props.custom.drawioImage.imageAlign = style.get('imageAlign');
  // @ts-ignore
  props.custom.drawioImage.imageValign = style.get('imageVerticalAlign');

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
  style: StyleManager,
  diagram: Diagram,
  layer: Layer
) => {
  props.custom ??= {};
  props.custom.roundedRect = {
    radius:
      style.get('absoluteArcSize') === '1'
        ? Math.min(bounds.w / 2, bounds.h / 2, parseNum(style.get('arcSize'), 10) / 2)
        : (parseNum(style.get('arcSize'), 10) * Math.min(bounds.w, bounds.h)) / 100
  };
  return new DiagramNode(id, 'rounded-rect', bounds, diagram, layer, props, metadata, texts);
};
