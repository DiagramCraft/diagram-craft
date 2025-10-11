import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import type { ShapeParser } from '../../drawioReader';
import { DiagramNode, NodeTexts, SimpleDiagramNode } from '@diagram-craft/model/diagramNode';
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
import { StyleManager } from '../../styleManager';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

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
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
): Promise<DiagramNode> => {
  const $c = (props.custom ??= {});
  if (style.str('shape') === 'mxgraph.android.progressBar') {
    $c.androidProgressBar ??= {};
    $c.androidProgressBar.width = style.num('strokeWidth', 2);
    $c.androidProgressBar.dx1 = style.num('dx1', 0.25);
    $c.androidProgressBar.dx2 = style.num('dx2', 0.75);
  } else if (style.str('shape')?.startsWith('mxgraph.android.quickscroll2')) {
    $c.androidQuickscroll2 ??= {};
    $c.androidQuickscroll2.dy = style.num('dy', 0.5);
  } else if (style.str('shape')?.startsWith('mxgraph.android.quickscroll3')) {
    $c.androidQuickscroll3 ??= {};
    $c.androidQuickscroll3.dy = style.num('dy', 0.5);
  } else if (style.str('shape')?.startsWith('mxgraph.android.progressScrubber')) {
    $c.androidProgressScrubber ??= {};
    $c.androidProgressScrubber.dx = style.num('dx', 0.5);
    if (style.str('shape') === 'mxgraph.android.progressScrubberDisabled') {
      $c.androidProgressScrubber.state = 'disabled';
      style.set('shape', 'mxgraph.android.progressScrubber');
    } else if (style.str('shape') === 'mxgraph.android.progressScrubberPressed') {
      $c.androidProgressScrubber.state = 'pressed';
      style.set('shape', 'mxgraph.android.progressScrubber');
    } else if (style.str('shape') === 'mxgraph.android.progressScrubberFocused') {
      $c.androidProgressScrubber.state = 'focused';
      style.set('shape', 'mxgraph.android.progressScrubber');
    }
  }

  return SimpleDiagramNode.create(id, style.str('shape')!, bounds, layer, props, metadata, texts);
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
