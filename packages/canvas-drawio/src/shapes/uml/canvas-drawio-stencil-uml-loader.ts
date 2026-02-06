import {
  addStencil,
  MakeStencilNodeOptsProps,
  NodeDefinitionRegistry,
  Registry,
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

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLShapes(registry.nodes);

  const umlStencils: Omit<StencilPackage, 'id' | 'name'> = { stencils: [], type: 'default' };

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

  addStencil(umlStencils, new UmlActor(), { aspectRatio: 0.6, props });

  addStencil(umlStencils, new Folder(), {
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

  addStencil(umlStencils, new UmlEntity(), { props });

  addStencil(umlStencils, new UmlControl(), { aspectRatio: 7 / 8, props });

  addStencil(umlStencils, new UmlDestroy(), { size: { w: 10, h: 10 } });

  addStencil(umlStencils, new UmlLifeline(), { props });

  addStencil(umlStencils, new UmlBoundary(), {
    aspectRatio: 1.25,
    texts: {
      text: 'Boundary Object'
    }
  });

  addStencil(umlStencils, new UmlFrame(), { props });

  addStencil(umlStencils, new UmlModuleNodeDefinition(), {
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

  addStencil(umlStencils, new ProvidedRequiredInterface(), {
    props,
    size: { w: 20, h: 20 }
  });

  addStencil(umlStencils, new RequiredInterface(), {
    props,
    size: { w: 20, h: 20 },
    aspectRatio: 0.5
  });

  return umlStencils;
};

export const registerUMLShapes = async (r: NodeDefinitionRegistry) => {
  r.register(new UmlActor());
  r.register(new Folder());
  r.register(new UmlEntity());
  r.register(new UmlControl());
  r.register(new UmlDestroy());
  r.register(new UmlLifeline());
  r.register(new UmlBoundary());
  r.register(new UmlFrame());
  r.register(new UmlModuleNodeDefinition());
  r.register(new ProvidedRequiredInterface());
  r.register(new RequiredInterface());

  shapeParsers['umlLifeline'] = parseUMLShapes;
  shapeParsers['module'] = parseUMLShapes;
  shapeParsers['component'] = parseUMLShapes;
};
