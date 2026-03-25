import {
  getStencilSubPackage,
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

type PendingNodeLinkResolution = {
  stencils: Array<Stencil>;
  stencilIdsInFile: ReadonlySet<string>;
  subPackage?: StencilSubPackage;
};

export class YamlStencilLoader {
  private readonly pendingNodeLinkResolutions: Array<PendingNodeLinkResolution> = [];

  constructor(private readonly pkg: StencilPackage) {}

  registerPackage(stencils: unknown): void {
    this.register(undefined, stencils);
  }

  registerSubPackage(subPackage: string, stencils: unknown): void {
    this.register(getStencilSubPackage(this.pkg, subPackage), stencils);
  }

  apply() {
    for (const resolution of this.pendingNodeLinkResolutions) {
      for (const stencil of resolution.stencils) {
        stencil.nodeLinkOptions = this.resolveNodeLinkOptions(
          // biome-ignore lint/suspicious/noExplicitAny: yaml loader stores nodeLinkOptions outside the narrowed Stencil settings type
          (stencil.settings as any)?.nodeLinkOptions,
          resolution.stencilIdsInFile,
          resolution.subPackage
        );
      }
    }

    this.pendingNodeLinkResolutions.length = 0;
    return this.pkg;
  }

  private mergePickerProps(
    elements: ReadonlyArray<SerializedElementWithPickerProps>
  ): Array<SerializedElement> {
    return elements.map(element => {
      const cloned = deepClone(element);
      const { pickerProps, children, ...rest } = cloned;

      return {
        ...rest,
        // biome-ignore lint/suspicious/noExplicitAny: node and edge props share the same merge semantics here
        props: deepMerge({}, cloned.props as any, pickerProps as any),
        children: children ? this.mergePickerProps(children) : undefined
      } as SerializedElement;
    });
  }

  private qualifyStencilId = (
    id: string,
    stencilIdsInFile: ReadonlySet<string>,
    subPackage?: StencilSubPackage
  ) => {
    if (id === NODE_LINK_POPUP_NO_SHAPE_ID) return id;
    if (id.includes(STENCIL_ID_DELIMITER)) return id;
    if (!stencilIdsInFile.has(id)) return id;
    if (subPackage) {
      return `${this.pkg.id}${STENCIL_ID_DELIMITER}${subPackage.id}${STENCIL_ID_DELIMITER}${id}`;
    }
    return `${this.pkg.id}${STENCIL_ID_DELIMITER}${id}`;
  };

  private resolveNodeLinkOptions = (
    nodeLinkOptions: NodeLinkOptions | undefined,
    stencilIdsInFile: ReadonlySet<string>,
    subPackage?: StencilSubPackage
  ): NodeLinkOptions | undefined => {
    if (nodeLinkOptions === undefined) return undefined;

    return {
      ...nodeLinkOptions,
      nodeStencilIds: nodeLinkOptions.nodeStencilIds?.map(id =>
        this.qualifyStencilId(id, stencilIdsInFile, subPackage)
      ),
      allowedCombinations: nodeLinkOptions.allowedCombinations?.map(c => ({
        ...c,
        nodeStencilId:
          c.nodeStencilId === undefined
            ? undefined
            : this.qualifyStencilId(c.nodeStencilId, stencilIdsInFile, subPackage)
      }))
    };
  };

  private register = (
    subPackage: StencilSubPackage | undefined,
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    stencils: any
  ): void => {
    // TODO: Cast stencils into some appropriate type

    const dest: Array<Stencil> = [];
    const stencilIdsInFile = new Set<string>(
      stencils.stencils.map((stencil: { id: string }) => stencil.id)
    );

    for (const stencil of stencils.stencils) {
      const mkNode = (registry: Registry, t: 'picker' | 'canvas') => {
        const { diagram, layer } = StencilUtils.makeDiagram(registry);

        return UnitOfWork.execute(diagram, uow => {
          const serializedElements =
            t === 'picker'
              ? this.mergePickerProps(stencil.node ? [stencil.node] : stencil.elements)
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
        nodeLinkOptions: stencil.settings?.nodeLinkOptions,
        styles: stencil.styles,
        settings: stencil.settings,
        forPicker: registry => mkNode(registry, 'picker'),
        forCanvas: registry => mkNode(registry, 'canvas'),
        type: 'yaml'
      });
    }

    if (subPackage) {
      subPackage.stencils.push(...dest);
    } else {
      this.pkg.stencils.push(...dest);
    }

    this.pendingNodeLinkResolutions.push({
      stencils: dest,
      stencilIdsInFile,
      subPackage
    });
  };
}
