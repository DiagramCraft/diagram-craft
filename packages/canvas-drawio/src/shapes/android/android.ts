import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { ShapeParser, Style } from '../../drawioReader';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { parseNum } from '../../utils';
import { DrawioShapeNodeDefinition } from '../../DrawioShape.nodeType';
import { Spinner2NodeDefinition } from './spinner2.nodeType';
import { AndroidRectNodeDefinition } from './androidRect.nodeType';
import { AndroidProgressBarDefinition } from './androidProgressBar.nodeType';
import { AndroidProgressScrubber } from './androidProgressScrubber.nodeType';
import { AndroidQuickscroll2 } from './androidQuickscroll2.nodeType';
import { AndroidQuickscroll3 } from './androidQuickscroll3.nodeType';
import { AndroidRRectNodeDefinition } from './androidRRect.nodeType';
import { AndroidAnchorNodeDefinition } from './androidAnchor.nodeType';
import { AndroidScrollbars2NodeDefinition } from './androidScrollbars2.nodeType';
import { AndroidCheckboxNodeDefinition } from './androidCheckbox.nodeType';
import { AndroidIndeterminateSpinner } from './androidIndeterminateSpinner.nodeType';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  registry.register(
    new DrawioShapeNodeDefinition(`mxgraph.android.${toTypeName(name)}`, name, stencil)
  );
};

export const parseAndroidShapes = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  style: Style,
  diagram: Diagram,
  layer: Layer
): Promise<DiagramNode> => {
  if (style.shape === 'mxgraph.android.progressBar') {
    props.shapeAndroidProgressBar ??= {};
    props.shapeAndroidProgressBar.width = parseNum(style.strokeWidth, 2);
    props.shapeAndroidProgressBar.dx1 = parseNum(style.dx1, 0.25);
    props.shapeAndroidProgressBar.dx2 = parseNum(style.dx2, 0.75);
  } else if (style.shape?.startsWith('mxgraph.android.quickscroll2')) {
    props.shapeAndroidQuickscroll2 ??= {};
    props.shapeAndroidQuickscroll2.dy = parseNum(style.dy, 0.5);
  } else if (style.shape?.startsWith('mxgraph.android.quickscroll3')) {
    props.shapeAndroidQuickscroll3 ??= {};
    props.shapeAndroidQuickscroll3.dy = parseNum(style.dy, 0.5);
  } else if (style.shape?.startsWith('mxgraph.android.progressScrubber')) {
    props.shapeAndroidProgressScrubber ??= {};
    props.shapeAndroidProgressScrubber.dx = parseNum(style.dx, 0.5);
    if (style.shape === 'mxgraph.android.progressScrubberDisabled') {
      props.shapeAndroidProgressScrubber.state = 'disabled';
      style.shape = 'mxgraph.android.progressScrubber';
    } else if (style.shape === 'mxgraph.android.progressScrubberPressed') {
      props.shapeAndroidProgressScrubber.state = 'pressed';
      style.shape = 'mxgraph.android.progressScrubber';
    } else if (style.shape === 'mxgraph.android.progressScrubberFocused') {
      props.shapeAndroidProgressScrubber.state = 'focused';
      style.shape = 'mxgraph.android.progressScrubber';
    }
  }

  return new DiagramNode(id, style.shape!, bounds, diagram, layer, props);
};

export const registerAndroidShapes = async (
  r: NodeDefinitionRegistry,
  shapeParsers: Record<string, ShapeParser>
) => {
  const stencils = await loadDrawioStencils(
    '/stencils/android/android.xml',
    'Android',
    '#00BEF2',
    'white'
  );

  shapeParsers['mxgraph.android.progressBar'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.quickscroll2'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.quickscroll3'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.progressScrubber'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.progressScrubberDisabled'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.progressScrubberPressed'] = parseAndroidShapes;
  shapeParsers['mxgraph.android.progressScrubberFocused'] = parseAndroidShapes;

  r.register(new Spinner2NodeDefinition());
  r.register(new AndroidRectNodeDefinition());
  r.register(new AndroidProgressBarDefinition());
  r.register(new AndroidProgressScrubber());
  r.register(new AndroidQuickscroll2());
  r.register(new AndroidQuickscroll3());
  r.register(new AndroidRRectNodeDefinition());
  r.register(new AndroidAnchorNodeDefinition());
  r.register(new AndroidScrollbars2NodeDefinition());
  r.register(new AndroidCheckboxNodeDefinition());
  r.register(new AndroidIndeterminateSpinner());

  registerStencil(r, 'phone2', stencils);
  registerStencil(r, 'tab2', stencils);
  registerStencil(r, 'action bar', stencils);
  registerStencil(r, 'action bar landscape', stencils);
  registerStencil(r, 'contact badge focused', stencils);
  registerStencil(r, 'contact badge normal', stencils);
  registerStencil(r, 'contact badge pressed', stencils);
  registerStencil(r, 'contextual action bar', stencils);
  registerStencil(r, 'contextual action bar white', stencils);
  registerStencil(r, 'contextual action bar landscape', stencils);
  registerStencil(r, 'contextual action bar landscape white', stencils);
  registerStencil(r, 'contextual split action bar', stencils);
  registerStencil(r, 'contextual split action bar white', stencils);
  registerStencil(r, 'contextual split action bar landscape', stencils);
  registerStencil(r, 'contextual split action bar landscape white', stencils);
  registerStencil(r, 'indeterminate progress bar', stencils);
  registerStencil(r, 'keyboard', stencils);
  registerStencil(r, 'navigation bar 1', stencils);
  registerStencil(r, 'navigation bar 1 landscape', stencils);
  registerStencil(r, 'navigation bar 1 vertical', stencils);
  registerStencil(r, 'navigation bar 2', stencils);
  registerStencil(r, 'navigation bar 3', stencils);
  registerStencil(r, 'navigation bar 3 landscape', stencils);
  registerStencil(r, 'navigation bar 4', stencils);
  registerStencil(r, 'navigation bar 5', stencils);
  registerStencil(r, 'navigation bar 5 vertical', stencils);
  registerStencil(r, 'navigation bar 6', stencils);
  registerStencil(r, 'quick contact', stencils);
};
