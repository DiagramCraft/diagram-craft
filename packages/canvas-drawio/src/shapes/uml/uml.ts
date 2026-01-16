import {
  MakeStencilNodeOptsProps,
  NodeDefinitionRegistry,
  registerStencil,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { UmlModuleNodeDefinition } from './umlModule';
import { Box } from '@diagram-craft/geometry/box';
import { shapeParsers } from '../../drawioShapeParserRegistry';
import { NodeTexts } from '@diagram-craft/model/diagramNode';
import { deepMerge } from '@diagram-craft/utils/object';
import stencils from './uml.yaml';
import { UmlLifeline } from './umlLifeline.nodeType';
import { UmlActor } from './umlActor.nodeType';
import { Folder } from './folder.nodeType';
import { UmlControl } from './umlControl.nodeType';
import { UmlDestroy } from './umlDestroy.nodeType';
import { UmlBoundary } from './umlBoundary.nodeType';
import { UmlEntity } from './umlEntity.nodeType';
import { UmlFrame } from './umlFrame.nodeType';
import { ProvidedRequiredInterface } from './providedRequiredInterface.nodeType';
import { RequiredInterface } from './requiredInterface.nodeType';
import { StyleManager } from '../../styleManager';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import type { ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';

export const parseUMLShapes = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
) => {
  props.custom ??= {};
  if (style.str('shape') === 'module' || style.str('shape') === 'component') {
    props.custom.umlModule = {
      jettyWidth: style.num('jettyWidth', 20),
      jettyHeight: style.num('jettyHeight', 10)
    };
    return ElementFactory.node(id, 'module', bounds, layer, props, {});
  } else if (style.str('shape') === 'umlLifeline') {
    props.custom.umlLifeline = {
      participant: style.str('participant')
    };
  }

  return ElementFactory.node(id, style.str('shape')!, bounds, layer, props, metadata, texts);
};

export const registerUMLShapes = async (r: NodeDefinitionRegistry) => {
  const umlStencils: StencilPackage = { id: 'uml', name: 'UML', stencils: [], type: 'default' };

  umlStencils.stencils.push(...loadStencilsFromYaml(stencils));

  const props: MakeStencilNodeOptsProps = () => ({
    fill: {
      color: 'var(--canvas-bg2)'
    },
    text: {
      fontSize: 12,
      top: 7,
      left: 7,
      right: 7,
      bottom: 7
    }
  });

  const mergedProps: (p: Partial<NodeProps>) => MakeStencilNodeOptsProps = p => () =>
    deepMerge(props('picker'), p);

  registerStencil(r, umlStencils, new UmlActor(), { aspectRatio: 0.6, props });

  registerStencil(r, umlStencils, new Folder(), {
    aspectRatio: 1.5,
    props: mergedProps({
      text: {
        bold: true,
        top: 12
      }
    }),
    texts: {
      text: 'package'
    }
  });

  registerStencil(r, umlStencils, new UmlEntity(), { props });

  registerStencil(r, umlStencils, new UmlControl(), { aspectRatio: 7 / 8, props });

  registerStencil(r, umlStencils, new UmlDestroy(), { size: { w: 10, h: 10 } });

  registerStencil(r, umlStencils, new UmlLifeline(r), { props });

  registerStencil(r, umlStencils, new UmlBoundary(), {
    aspectRatio: 1.25,
    texts: {
      text: 'Boundary Object'
    }
  });

  registerStencil(r, umlStencils, new UmlFrame(), { props });

  registerStencil(r, umlStencils, new UmlModuleNodeDefinition(), {
    props: mergedProps({
      text: {
        left: 22,
        valign: 'top'
      }
    }),
    texts: {
      text: 'Module'
    },
    size: { w: 90, h: 50 }
  });

  registerStencil(r, umlStencils, new ProvidedRequiredInterface(), {
    props,
    size: { w: 20, h: 20 }
  });

  registerStencil(r, umlStencils, new RequiredInterface(), {
    props,
    size: { w: 20, h: 20 },
    aspectRatio: 0.5
  });

  shapeParsers['umlLifeline'] = parseUMLShapes;
  shapeParsers['module'] = parseUMLShapes;
  shapeParsers['component'] = parseUMLShapes;

  r.stencilRegistry.register(umlStencils, true);
};
