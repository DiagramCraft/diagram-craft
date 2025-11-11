import { Box } from '@diagram-craft/geometry/box';
import { NodeTexts } from '@diagram-craft/model/diagramNode';
import type { WorkQueue } from './drawioReader';
import { Angle } from '@diagram-craft/geometry/angle';
import { dataURItoBlob } from './blobUtils';
import { assertHAlign, assertVAlign, HAlign } from '@diagram-craft/model/diagramProps';
import { FullDirection } from '@diagram-craft/geometry/direction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { StyleManager } from './styleManager';
import { parseNum } from '@diagram-craft/utils/number';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

const makeShape = (
  type: string,
  setProps: (
    s: StyleManager,
    p: DiagramCraft.NodeProps & { custom: DiagramCraft.CustomNodeProps }
  ) => void = () => {}
) => {
  return async (
    id: string,
    bounds: Box,
    props: DiagramCraft.NodeProps,
    metadata: DiagramCraft.ElementMetadata,
    texts: NodeTexts,
    style: StyleManager,
    layer: RegularLayer
  ) => {
    props.custom ??= {};
    setProps(style, props as DiagramCraft.NodeProps & { custom: DiagramCraft.CustomNodeProps });
    return ElementFactory.node(id, type, bounds, layer, props, metadata, texts);
  };
};

export const parseHexagon = makeShape('hexagon', (style, props) => {
  props.custom.hexagon = {
    size: style.num('size', 50) / 2
  };
});

export const parseStep = makeShape('step', (style, props) => {
  props.custom.step = {
    size: style.num('size', 25)
  };
});

export const parsePartialRect = makeShape('partial-rect', (style, props) => {
  props.custom.partialRect = {
    north: style.is('top', true),
    south: style.is('bottom', true),
    east: style.is('right', true),
    west: style.is('left', true)
  };
});

export const parseRect = async (
  id: string,
  bounds: Box,
  props: DiagramCraft.NodeProps,
  metadata: DiagramCraft.ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
) => {
  if (style.is('rounded'))
    return parseRoundedRect(id, bounds, props, metadata, texts, style, layer);
  return ElementFactory.node(id, 'rect', bounds, layer, props, metadata, texts);
};

export const parseCube = makeShape('cube');

export const parseTransparent = makeShape('transparent', (style, props) => {
  props.text!.valign = 'middle';
  props.text!.top = parseNum(style.getOverride('spacingTop'), 2);
});

export const parseLine = makeShape('line');

export const parseDelay = makeShape('delay');

export const parseCloud = makeShape('cloud');

export const parseDocument = makeShape('document');

export const parseTable = makeShape('table', (style, props) => {
  props.custom.table = {
    gap: 0,
    title: style.has('startSize'),
    titleSize: style.num('startSize', 0)
  };
});

export const parseSwimlane = makeShape('swimlane', (style, props) => {
  props.custom.swimlane = {
    title: true,
    titleBorder: true,
    titleSize: style.num('startSize', 20),
    horizontalBorder: false
  };
});

export const parseTableRow = makeShape('tableRow');

export const parseRhombus = makeShape('diamond');

export const parseParallelogram = makeShape('parallelogram', (style, props) => {
  props.custom.parallelogram = {
    slant: style.num('size', 20)
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
    size: style.num('size', 8) * 2,
    direction: (directionMap[style.str('direction')! as keyof typeof directionMap] ?? 'north') as
      | 'east'
      | 'north'
      | 'south'
      | 'west'
  };
});

export const parseProcess = makeShape('process', (style, props) => {
  props.custom.process = {
    size: style.num('size', 0.125) * 100
  };
});

export const parseCurlyBracket = makeShape('curlyBracket', (style, props) => {
  props.custom.curlyBracket = {
    size: style.num('size', 0.5) * 100
  };
});

export const parseBlockArc = makeShape('blockArc', (style, props) => {
  props.custom.blockArc = {
    innerRadius: 100 - style.num('arcWidth', 0.5) * 100,
    startAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - style.num('endAngle', 0.5))),
    endAngle: Angle.toDeg(Math.PI / 2 + 2 * Math.PI * (1 - style.num('startAngle', 0.3)))
  };

  if (props.custom.blockArc.endAngle === 0) {
    props.custom.blockArc.endAngle = 359.999;
  }
});

export const parseTriangle = makeShape('triangle', (style, props) => {
  props.custom.triangle = {
    direction: (style.str('direction') ?? 'east') as FullDirection
  };
});

export const parseEllipse = makeShape('circle', (style, props) => {
  props.text!.align = (style.str('align') ?? 'center') as HAlign;
});

export const parseDiamond = makeShape('diamond');

export const parseArrow = async (
  id: string,
  bounds: Box,
  props: DiagramCraft.NodeProps,
  metadata: DiagramCraft.ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
) => {
  let type = 'arrow-right';
  if (style.str('direction') === 'north') {
    type = 'arrow-up';
  } else if (style.str('direction') === 'south') {
    type = 'arrow-down';
  }

  props.custom ??= {};
  props.custom.arrow = {};
  props.custom.arrow.notch = style.num('notch', 0);
  props.custom.arrow.y = style.num('dy', 0.2) * 50;
  props.custom.arrow.x = style.num('dx', 20);

  return ElementFactory.node(id, type, bounds, layer, props, metadata, texts);
};

export const parseImage = async (
  id: string,
  bounds: Box,
  props: DiagramCraft.NodeProps,
  metadata: DiagramCraft.ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer,
  queue: WorkQueue
) => {
  const diagram = layer.diagram;
  const image = style.str('image') ?? '';

  props.fill!.type = 'image';
  props.fill!.color = 'transparent';

  props.custom ??= {};
  props.custom.drawioImage ??= {};

  const isImageShape = style.str('shape') === 'image' || style.styleName === 'image';

  props.custom.drawioImage.stylename = style.styleName;
  props.custom.drawioImage.imageMargin = style.num('_imageMargin');

  props.custom.drawioImage.imageHeight = style.str('imageHeight');
  props.custom.drawioImage.imageWidth = style.str('imageWidth');

  props.custom.drawioImage.keepAspect =
    style.is('imageAspect', true) && !style.has('imageHeight') && !style.has('imageWidth');
  props.custom.drawioImage.flipV = style.is('imageFlipV');
  props.custom.drawioImage.flipH = style.is('imageFlipH');
  props.custom.drawioImage.showLabel = !style.is('noLabel');

  if (!style.str('imageBorder')) {
    if (style.str('strokeColor') && !isImageShape) {
      props.stroke!.enabled = true;
      props.stroke!.color = style.str('strokeColor');
    } else {
      props.stroke!.enabled = false;
      props.stroke!.width = 0;
    }

    if (style.is('rounded', true) && !isImageShape) {
      props.effects ??= {};
      props.effects.rounding = true;
    }
  } else {
    props.stroke!.color = style.str('imageBorder');
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

  props.custom.drawioImage.backgroundColor = style.str('imageBackground');

  const align = style.str('imageAlign');
  assertHAlign(align);
  props.custom.drawioImage.imageAlign = align;

  const valign = style.str('imageVerticalAlign');
  assertVAlign(valign);
  props.custom.drawioImage.imageValign = valign;

  const node = ElementFactory.node(id, 'drawioImage', bounds, layer, props, metadata, texts);

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
      img.src = props.fill.image.url!;
    }
  });

  return node;
};

export const parseRoundedRect = async (
  id: string,
  bounds: Box,
  props: DiagramCraft.NodeProps,
  metadata: DiagramCraft.ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
) => {
  props.custom ??= {};
  props.custom.roundedRect = {
    radius: style.is('absoluteArcSize')
      ? Math.min(bounds.w / 2, bounds.h / 2, style.num('arcSize', 10) / 2)
      : (style.num('arcSize', 10) * Math.min(bounds.w, bounds.h)) / 100
  };
  return ElementFactory.node(id, 'rounded-rect', bounds, layer, props, metadata, texts);
};
