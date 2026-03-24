import {
  type Stencil,
  STENCIL_ID_DELIMITER,
  type StencilPackage,
  type StencilSubPackage
} from './stencilRegistry';
import { NODE_LINK_POPUP_NO_SHAPE_ID, type NodeLinkOptions } from './stencilRegistry';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { SerializedElement } from './serialization/serializedTypes';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilUtils } from '@diagram-craft/model/stencilUtils';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';

type SerializedElementWithPickerProps = SerializedElement & {
  pickerProps?: SerializedElement['props'];
  children?: Array<SerializedElementWithPickerProps>;
};

const mergePickerProps = (
  elements: ReadonlyArray<SerializedElementWithPickerProps>
): Array<SerializedElement> => {
  return elements.map(element => {
    const cloned = deepClone(element);
    const { pickerProps, children, ...rest } = cloned;

    return {
      ...rest,
      // biome-ignore lint/suspicious/noExplicitAny: node and edge props share the same merge semantics here
      props: deepMerge({}, cloned.props as any, pickerProps as any),
      children: children ? mergePickerProps(children) : undefined
    } as SerializedElement;
  });
};

export const loadStencilsFromYaml = (
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  stencils: any,
  pkg?: StencilPackage,
  subPackage?: StencilSubPackage
) => {
  const dest: Array<Stencil> = [];
  const stencilIdsInFile = new Set<string>(
    stencils.stencils.map((stencil: { id: string }) => stencil.id)
  );

  const qualifyStencilId = (id: string) => {
    if (id === NODE_LINK_POPUP_NO_SHAPE_ID) return id;
    if (id.includes(STENCIL_ID_DELIMITER)) return id;
    if (!stencilIdsInFile.has(id)) return id;
    if (!pkg?.id) return id;
    if (subPackage)
      return `${pkg.id}${STENCIL_ID_DELIMITER}${subPackage.id}${STENCIL_ID_DELIMITER}${id}`;
    return `${pkg.id}${STENCIL_ID_DELIMITER}${id}`;
  };

  const resolveNodeLinkOptions = (
    nodeLinkOptions: NodeLinkOptions | undefined
  ): NodeLinkOptions | undefined => {
    if (nodeLinkOptions === undefined) return undefined;

    return {
      ...nodeLinkOptions,
      nodeStencilIds: nodeLinkOptions.nodeStencilIds?.map(qualifyStencilId),
      allowedCombinations: nodeLinkOptions.allowedCombinations?.map(c => ({
        ...c,
        nodeStencilId: c.nodeStencilId === undefined ? undefined : qualifyStencilId(c.nodeStencilId)
      }))
    };
  };

  for (const stencil of stencils.stencils) {
    const mkNode = (registry: Registry, t: 'picker' | 'canvas') => {
      const { diagram, layer } = StencilUtils.makeDiagram(registry);

      return UnitOfWork.execute(diagram, uow => {
        const serializedElements =
          t === 'picker'
            ? mergePickerProps(stencil.node ? [stencil.node] : stencil.elements)
            : deepClone(stencil.node ? [stencil.node] : stencil.elements);
        const elements = deserializeDiagramElements(
          serializedElements,
          layer,
          uow,
          undefined,
          new ElementLookup<DiagramNode>(),
          new ElementLookup<DiagramEdge>()
        );
        elements.forEach(e => layer.addElement(e, uow));

        const bounds = Box.asReadWrite(Box.boundingBox(elements.map(e => e.bounds)));

        bounds.x -= (stencil as Stencil).settings?.marginLeft ?? 0;
        bounds.w += (stencil as Stencil).settings?.marginLeft ?? 0;

        bounds.y -= (stencil as Stencil).settings?.marginTop ?? 0;
        bounds.h += (stencil as Stencil).settings?.marginTop ?? 0;

        bounds.w += (stencil as Stencil).settings?.marginRight ?? 0;
        bounds.h += (stencil as Stencil).settings?.marginBottom ?? 0;

        return { elements, bounds: WritableBox.asBox(bounds), diagram, layer };
      });
    };
    dest.push({
      id: stencil.id,
      name: stencil.name,
      nodeLinkOptions: resolveNodeLinkOptions(stencil.settings?.nodeLinkOptions),
      styles: stencil.styles,
      settings: stencil.settings,
      forPicker: registry => mkNode(registry, 'picker'),
      forCanvas: registry => mkNode(registry, 'canvas'),
      type: 'yaml'
    });
  }

  if (subPackage) {
    subPackage.stencils.push(...dest);
  } else if (pkg) {
    pkg.stencils.push(...dest);
  }

  return dest;
};
