import { loadStencil } from '../stencilLoader';
import { NodeDefinitionRegistry, Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { findStencilByName, stencilNameToType } from './shapeUtils';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<Stencil>
) => {
  const stencil = findStencilByName(stencils, name);

  stencil.node.name = name;
  stencil.node.type = 'mxgraph.android.' + stencilNameToType(name);

  registry.register(stencil.node, stencil);
};

export const registerAndroidShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadStencil(
    '/stencils/android/android.xml',
    'Android',
    '#00BEF2',
    'white'
  );

  registerStencil(r, 'phone2', stencils);
  registerStencil(r, 'tab2', stencils);
  registerStencil(r, 'action bar', stencils);
  registerStencil(r, 'action bar landscape', stencils);
  //  registerStencil(r, 'rrect', stencils);
  //registerStencil(r, 'checkbox', stencils);
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
  //registerStencil(r, 'indeterminateSpinner', stencils);
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
  //registerStencil(r, 'progressBar', stencils);
  //registerStencil(r, 'progressScrubberDisabled', stencils);
  //registerStencil(r, 'progressScrubberFocused', stencils);
  //registerStencil(r, 'progressScrubberPressed', stencils);
  //registerStencil(r, 'quickscroll2', stencils);
  //registerStencil(r, 'quickscroll3', stencils);
  //registerStencil(r, 'anchor', stencils);
  //registerStencil(r, 'scrollbars2', stencils);
  //registerStencil(r, 'spinner2', stencils);
  //registerStencil(r, 'rect', stencils);
};
