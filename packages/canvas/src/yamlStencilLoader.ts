import {
  getStencilSubPackage,
  NODE_LINK_POPUP_NO_SHAPE_ID,
  type NodeLinkOptions,
  type Stencil,
  STENCIL_ID_DELIMITER,
  type StencilPackage,
  type StencilStyleVariant,
  type StencilSubPackage
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
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { deepClone, deepMerge, isNonNullObj } from '@diagram-craft/utils/object';

type YamlStyleVariant = {
  id: string;
  name: string;
  styles: Array<YamlStencilStyle>;
};

export type YamlStencilFile = {
  stencils: Array<YamlStencilDefinition>;
  styles?: Array<YamlStencilStyle>;
  variants?: Array<YamlStyleVariant>;
};

export type YamlStencilStylesFile = {
  styles?: Array<YamlStencilStyle>;
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

type YamlStencilSettings = {
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  nodeLinkOptions?: NodeLinkOptions;
  [key: string]: unknown;
};

type SerializedElementWithPickerProps = SerializedElement & {
  pickerProps?: SerializedElement['props'];
  children?: Array<SerializedElementWithPickerProps>;
};

type StencilDef = {
  stencil: Stencil;
  yamlStencil: YamlStencilDefinition;
};

type PendingStencilFinalization = {
  stencilDefs: Array<StencilDef>;
  subPackage?: StencilSubPackage;
  styles: Array<YamlStencilStyle>;
  variants?: Array<YamlStyleVariant>;
};

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
      stencilDefs: [],
      styles: stencils.styles ?? []
    });
  }

  apply() {
    const stylesById = this.getStylesById();
    const stencilIdsByTarget = this.getStencilIdsBySubPackage();

    // Collect package-level variants from all registrations
    const variantMap = new Map<string, StencilStyleVariant>();
    for (const finalization of this.pendingStencilFinalizations) {
      if (finalization.variants) {
        for (const variant of finalization.variants) {
          if (!variantMap.has(variant.id)) {
            variantMap.set(variant.id, { id: variant.id, name: variant.name, styles: variant.styles });
          }
        }
      }
    }
    if (variantMap.size > 0) {
      this.pkg.styleVariants = Array.from(variantMap.values());
    }

    for (const finalization of this.pendingStencilFinalizations) {
      const stencilIds = mustExist(
        stencilIdsByTarget.get(this.subPackageKey(finalization.subPackage))
      );

      for (const def of finalization.stencilDefs) {
        def.stencil.settings ??= {};
        def.stencil.settings.nodeLinkOptions = this.resolveNodeLinkOptions(
          def.stencil.settings?.nodeLinkOptions,
          stencilIds,
          finalization.subPackage
        );
        def.stencil.styles = this.resolveStyles(def.yamlStencil.styles, stylesById);

        // Also include styles referenced via nodeLinkOptions so they are available
        // when the stencil is dropped onto the canvas (copyStyles, addStencilStylesToDocument, etc.)
        const nodeLinkOptions = def.stencil.settings?.nodeLinkOptions;
        if (nodeLinkOptions) {
          const existingIds = new Set(def.stencil.styles?.map(s => s.id));
          const referencedIds = [
            ...(nodeLinkOptions.edgeStylesheetIds ?? []),
            ...(nodeLinkOptions.combinations?.flatMap(c =>
              c.edgeStylesheetId !== undefined ? [c.edgeStylesheetId] : []
            ) ?? [])
          ];
          for (const id of referencedIds) {
            if (!existingIds.has(id)) {
              const style = stylesById.get(id);
              if (style) {
                def.stencil.styles = [...(def.stencil.styles ?? []), deepClone(style)];
                existingIds.add(id);
              }
            }
          }
        }
      }
    }

    this.pendingStencilFinalizations.length = 0;
    return this.pkg;
  }

  private subPackageKey(subPackage?: StencilSubPackage): string {
    return subPackage?.id ?? '__package__';
  }

  private getStylesById(): Map<string, YamlStencilStyle> {
    const stylesById = new Map<string, YamlStencilStyle>();

    for (const resolution of this.pendingStencilFinalizations) {
      // Always include flat styles (those without variants).
      for (const style of resolution.styles) {
        const existing = stylesById.get(style.id);
        assert.true(existing === undefined, `dup style ${style.id}`);
        stylesById.set(style.id, style);
      }

      // When variants are defined, also add the first variant's styles so that
      // stencil `styles:` references that point to variant IDs resolve correctly.
      // Variant IDs must not overlap with flat style IDs (they are separate sets).
      if (resolution.variants && resolution.variants.length > 0 && resolution.variants[0] !== undefined) {
        for (const style of resolution.variants[0].styles) {
          const existing = stylesById.get(style.id);
          assert.true(existing === undefined, `dup style ${style.id} (also defined in flat styles)`);
          stylesById.set(style.id, style);
        }
      }
    }

    return stylesById;
  }

  private getStencilIdsBySubPackage(): Map<string, Set<string>> {
    const stencilIdsByTarget = new Map<string, Set<string>>();

    for (const resolution of this.pendingStencilFinalizations) {
      const targetKey = this.subPackageKey(resolution.subPackage);
      let stencilIds = stencilIdsByTarget.get(targetKey);
      if (stencilIds === undefined) {
        stencilIds = new Set<string>();
        stencilIdsByTarget.set(targetKey, stencilIds);
      }

      for (const stencil of resolution.stencilDefs) {
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

  private resolveNodeLinkOptions = (
    options: NodeLinkOptions | undefined,
    stencilIds: ReadonlySet<string>,
    subPackage?: StencilSubPackage
  ): NodeLinkOptions | undefined => {
    if (options === undefined) return undefined;

    options.stencilIds = options.stencilIds?.map(id =>
      this.resolveStencilId(id, stencilIds, subPackage)
    );
    options.combinations = options.combinations?.map(c => {
      if (c.stencilId !== undefined)
        c.stencilId = this.resolveStencilId(c.stencilId, stencilIds, subPackage);
      return c;
    });

    return options;
  };

  private resolveStyles = (
    styles: YamlStencilDefinition['styles'],
    stylesById: ReadonlyMap<string, YamlStencilStyle>
  ): Stencil['styles'] => {
    if (styles === undefined) return undefined;

    return styles.map(style => {
      if (typeof style === 'string') {
        return deepClone(mustExist(stylesById.get(style)));
      } else {
        return style;
      }
    });
  };

  private resolveStencilId = (
    id: string,
    stencilIds: ReadonlySet<string>,
    subPackage?: StencilSubPackage
  ) => {
    if (id === NODE_LINK_POPUP_NO_SHAPE_ID) return id;
    if (id.includes(STENCIL_ID_DELIMITER)) return id;

    if (!stencilIds.has(id)) return id;

    if (subPackage) {
      return [this.pkg.id, subPackage.id, id].join(STENCIL_ID_DELIMITER);
    } else {
      return [this.pkg.id, id].join(STENCIL_ID_DELIMITER);
    }
  };

  private register = (subPackage: StencilSubPackage | undefined, stencils: unknown): void => {
    assertYamlStencilFile(stencils);

    const dest: Array<StencilDef> = [];
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

      dest.push({
        stencil: {
          id: stencil.id,
          name: stencil.name,
          styles: undefined,
          settings: stencil.settings,
          forPicker: registry => mkNode(registry, 'picker'),
          forCanvas: registry => mkNode(registry, 'canvas'),
          type: 'yaml'
        },
        yamlStencil: stencil
      });
    }

    if (subPackage) {
      subPackage.stencils.push(...dest.map(entry => entry.stencil));
    } else {
      this.pkg.stencils.push(...dest.map(entry => entry.stencil));
    }

    this.pendingStencilFinalizations.push({
      stencilDefs: dest,
      subPackage,
      styles: stencils.styles ?? [],
      variants: stencils.variants
    });
  };
}

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
  if (styles !== undefined) {
    if (!Array.isArray(styles)) throw new Error(`${errorPrefix}: bad styles`);
    for (const style of styles) {
      assert.true(hasYamlStencilStyleShape(style), `${errorPrefix}: bad styles`);
    }
  }

  const variants = value.variants;
  if (variants !== undefined) {
    if (!Array.isArray(variants)) throw new Error(`${errorPrefix}: bad variants`);
    for (const variant of variants) {
      assert.true(
        isNonNullObj(variant) && typeof variant.id === 'string' && typeof variant.name === 'string' && Array.isArray(variant.styles),
        `${errorPrefix}: bad variant`
      );
      for (const style of variant.styles as unknown[]) {
        assert.true(hasYamlStencilStyleShape(style), `${errorPrefix}: bad variant style`);
      }
    }
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

export const _test = {
  assertYamlStencilFile,
  assertYamlStencilStylesFile
};
