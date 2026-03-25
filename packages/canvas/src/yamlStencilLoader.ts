import {
  getStencilSubPackage,
  type Stencil,
  STENCIL_ID_DELIMITER,
  type StencilPackage,
  type StencilSubPackage
} from '@diagram-craft/model/stencilRegistry';
import {
  NODE_LINK_POPUP_NO_SHAPE_ID,
  type NodeLinkOptions
} from '@diagram-craft/model/stencilRegistry';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import type { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilUtils } from '@diagram-craft/model/stencilUtils';
import { assert } from '@diagram-craft/utils/assert';
import { deepClone, deepMerge, isNonNullObj } from '@diagram-craft/utils/object';

type SerializedElementWithPickerProps = SerializedElement & {
  pickerProps?: SerializedElement['props'];
  children?: Array<SerializedElementWithPickerProps>;
};

type YamlStencilSettings = {
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  nodeLinkOptions?: NodeLinkOptions;
  [key: string]: unknown;
};

type YamlStencilStyle = NonNullable<Stencil['styles']>[number];

export type YamlStencilDefinition = {
  id: string;
  name?: string;
  title?: string;
  stencil?: string;
  node?: SerializedElementWithPickerProps;
  elements?: Array<SerializedElementWithPickerProps>;
  settings?: YamlStencilSettings;
  styles?: Array<YamlStencilStyle | string>;
};

export type YamlStencilFile = {
  stencils: Array<YamlStencilDefinition>;
  styles?: Array<YamlStencilStyle>;
};

export type YamlStencilStylesFile = {
  styles?: Array<YamlStencilStyle>;
};

type PendingStencilFinalization = {
  stencils: Array<{
    stencil: Stencil;
    yamlStencil: YamlStencilDefinition;
  }>;
  subPackage?: StencilSubPackage;
  styles: Array<YamlStencilStyle>;
};

const hasSerializedElementShape = (value: unknown): value is SerializedElementWithPickerProps => {
  if (!isNonNullObj(value)) return false;
  return typeof value.id === 'string' && typeof value.type === 'string';
};

const hasYamlStencilStyleShape = (value: unknown): value is YamlStencilStyle => {
  if (!isNonNullObj(value)) return false;
  return typeof value.id === 'string' && typeof value.type === 'string';
};

function assertTopLevelStyles(value: Record<string, unknown>, errorPrefix: string): void {
  const styles = value.styles;
  if (styles === undefined) return;

  if (!Array.isArray(styles)) throw new Error(`${errorPrefix}: bad styles`);

  for (const style of styles) {
    assert.true(hasYamlStencilStyleShape(style), `${errorPrefix}: bad styles`);
  }
}

function assertYamlStencilFile(value: unknown): asserts value is YamlStencilFile {
  if (!isNonNullObj(value) || !Array.isArray(value.stencils)) {
    throw new Error('bad yaml');
  }

  value.stencils.forEach((stencil, index) => {
    assert.true(isNonNullObj(stencil), `bad yaml stencil ${index}`);

    assert.true(typeof stencil.id === 'string' && stencil.id.length > 0, `bad stencil id ${index}`);

    const hasNode = stencil.node !== undefined;
    const hasElements = stencil.elements !== undefined;

    assert.true(hasNode || hasElements, `bad stencil shape ${stencil.id}`);

    assert.true(!hasNode || hasSerializedElementShape(stencil.node), `bad node ${stencil.id}`);

    if (hasElements) {
      assert.true(
        Array.isArray(stencil.elements) && stencil.elements.length > 0,
        `bad elements ${stencil.id}`
      );

      for (const element of stencil.elements) {
        assert.true(hasSerializedElementShape(element), `bad element ${stencil.id}`);
      }
    }
  });

  assertTopLevelStyles(value, 'bad yaml');
}

function assertYamlStencilStylesFile(value: unknown): asserts value is YamlStencilStylesFile {
  if (!isNonNullObj(value)) {
    throw new Error('bad yaml styles');
  }

  assertTopLevelStyles(value, 'bad yaml styles');
}

export class YamlStencilLoader {
  private readonly pendingStencilFinalizations: Array<PendingStencilFinalization> = [];

  constructor(private readonly pkg: StencilPackage) {}

  registerPackage(stencils: unknown): void {
    this.register(undefined, stencils);
  }

  registerSubPackage(subPackage: string, stencils: unknown): void {
    this.register(getStencilSubPackage(this.pkg, subPackage), stencils);
  }

  registerStyles(stencils: unknown): void {
    assertYamlStencilStylesFile(stencils);

    this.pendingStencilFinalizations.push({
      stencils: [],
      styles: stencils.styles ?? []
    });
  }

  apply() {
    const stylesById = this.buildStylesById();
    const stencilIdsByTarget = this.buildStencilIdsByTarget();

    for (const resolution of this.pendingStencilFinalizations) {
      const stencilIdsInTarget = stencilIdsByTarget.get(this.getTargetKey(resolution.subPackage));
      assert.present(stencilIdsInTarget, 'missing stencil scope');

      for (const stencil of resolution.stencils) {
        stencil.stencil.settings ??= {};
        stencil.stencil.settings.nodeLinkOptions = this.resolveNodeLinkOptions(
          // biome-ignore lint/suspicious/noExplicitAny: yaml loader stores nodeLinkOptions outside the narrowed Stencil settings type
          (stencil.stencil.settings as any)?.nodeLinkOptions,
          stencilIdsInTarget,
          resolution.subPackage
        );
        stencil.stencil.styles = this.resolveStyles(stencil.yamlStencil.styles, stylesById);
      }
    }

    this.pendingStencilFinalizations.length = 0;
    return this.pkg;
  }

  private getTargetKey(subPackage?: StencilSubPackage): string {
    return subPackage?.id ?? '__package__';
  }

  private buildStylesById(): Map<string, YamlStencilStyle> {
    const stylesById = new Map<string, YamlStencilStyle>();

    for (const resolution of this.pendingStencilFinalizations) {
      for (const style of resolution.styles) {
        const existing = stylesById.get(style.id);
        assert.true(existing === undefined, `dup style ${style.id}`);
        stylesById.set(style.id, style);
      }
    }

    return stylesById;
  }

  private buildStencilIdsByTarget(): Map<string, Set<string>> {
    const stencilIdsByTarget = new Map<string, Set<string>>();

    for (const resolution of this.pendingStencilFinalizations) {
      const targetKey = this.getTargetKey(resolution.subPackage);
      let stencilIds = stencilIdsByTarget.get(targetKey);
      if (stencilIds === undefined) {
        stencilIds = new Set<string>();
        stencilIdsByTarget.set(targetKey, stencilIds);
      }

      for (const stencil of resolution.stencils) {
        stencilIds.add(stencil.yamlStencil.id);
      }
    }

    return stencilIdsByTarget;
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

  private getSerializedElements(
    stencil: YamlStencilDefinition
  ): Array<SerializedElementWithPickerProps> {
    if (stencil.node !== undefined) return [stencil.node];
    if (stencil.elements !== undefined) return stencil.elements;
    throw new Error(`bad stencil shape ${stencil.id}`);
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

  private resolveStyles = (
    styles: YamlStencilDefinition['styles'],
    stylesById: ReadonlyMap<string, YamlStencilStyle>
  ): Stencil['styles'] => {
    if (styles === undefined) return undefined;

    return styles.map(style => {
      if (typeof style !== 'string') return style;

      const resolved = stylesById.get(style);
      assert.present(resolved, `missing style ${style}`);
      return deepClone(resolved);
    });
  };

  private register = (subPackage: StencilSubPackage | undefined, stencils: unknown): void => {
    assertYamlStencilFile(stencils);

    const dest: Array<{
      stencil: Stencil;
      yamlStencil: YamlStencilDefinition;
    }> = [];
    for (const stencil of stencils.stencils) {
      const mkNode = (registry: Registry, t: 'picker' | 'canvas') => {
        const { diagram, layer } = StencilUtils.makeDiagram(registry);
        const stencilElements = this.getSerializedElements(stencil);

        return UnitOfWork.execute(diagram, uow => {
          const serializedElements =
            t === 'picker' ? this.mergePickerProps(stencilElements) : deepClone(stencilElements);
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
      const registeredStencil: Stencil = {
        id: stencil.id,
        name: stencil.name,
        styles: undefined,
        settings: stencil.settings,
        forPicker: registry => mkNode(registry, 'picker'),
        forCanvas: registry => mkNode(registry, 'canvas'),
        type: 'yaml'
      };
      dest.push({
        stencil: registeredStencil,
        yamlStencil: stencil
      });
    }

    if (subPackage) {
      subPackage.stencils.push(...dest.map(entry => entry.stencil));
    } else {
      this.pkg.stencils.push(...dest.map(entry => entry.stencil));
    }

    this.pendingStencilFinalizations.push({
      stencils: dest,
      subPackage,
      styles: stencils.styles ?? []
    });
  };
}

export const _test = {
  assertYamlStencilFile,
  assertYamlStencilStylesFile
};
