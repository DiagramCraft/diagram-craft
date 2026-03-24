import { mustExist } from '@diagram-craft/utils/assert';
import type { NodeLinkOptions } from '@diagram-craft/canvas/context';
import type { EdgeDefinition } from '@diagram-craft/model/edgeDefinition';
import type { Diagram } from '@diagram-craft/model/diagram';
import { Box } from '@diagram-craft/geometry/box';
import { NodeDefinition, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { EventEmitter } from '@diagram-craft/utils/event';
import { safeSplit } from '@diagram-craft/utils/safe';
import { ElementProps } from '@diagram-craft/model/diagramProps';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepEquals } from '@diagram-craft/utils/object';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { MakeStencilNodeOpts, StencilUtils } from '@diagram-craft/model/stencilUtils';

export type StencilElements = {
  bounds: Box;
  elements: DiagramElement[];
  diagram: Diagram;
  layer: RegularLayer;
};

export type Stencil = {
  id: string;
  name?: string;
  nodeLinkOptions?: NodeLinkOptions;
  forPicker: (registry: Registry) => StencilElements;
  forCanvas: (registry: Registry) => StencilElements;
  styles?: Array<StencilStyle>;
  type: 'default' | string;
  settings?: {
    scaleStrokes?: boolean;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
  };
};

export type StencilSubPackage = {
  id: string;
  name: string;
  stencils: Array<Stencil>;
};
export type StencilPackage = {
  id?: string;
  stencils: Array<Stencil>;
  type: 'default' | string;

  subPackages?: Array<StencilSubPackage>;
};

export type StencilStyle = {
  id: string;
  name: string;
  type: 'edge' | 'node' | 'text';
  props: ElementProps;
  strokeColors?: string[];
  fillColors?: string[];
};

/* Stencil Loader ******************************************************************* */

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {}
  }
}

export interface StencilLoaderOpts extends DiagramCraft.StencilLoaderOptsExtensions {}

export type StencilLoader<T extends keyof StencilLoaderOpts> = (
  registry: Registry,
  opts: StencilLoaderOpts[T]
) => Promise<StencilPackage>;

export type StencilLoaderRegistry = Partial<{
  [K in keyof StencilLoaderOpts]: () => Promise<StencilLoader<K>>;
}>;

export const stencilLoaderRegistry: StencilLoaderRegistry = {};

/* Basic Stencil Loader ************************************************************* */

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {
      basic: {
        stencils: () => Promise<(registry: Registry) => Promise<StencilPackage>>;
      };
    }
  }
}

export const stencilLoaderBasic: StencilLoader<'basic'> = async (registry, opts) => {
  return await (
    await opts.stencils()
  )(registry);
};

/* Stencil Registry ***************************************************************** */

export type RegisteredStencilPackage = {
  id: string;
  name: string;
} & StencilPackage;

export type StencilEvents = {
  /* Stencils registered, activated or deactivated */
  change: { stencilRegistry: StencilRegistry };
};

export const STENCIL_ID_DELIMITER = '@@';

export class StencilRegistry extends EventEmitter<StencilEvents> {
  private stencils = new Map<string, RegisteredStencilPackage>();
  private loaded = new Set<string>();
  private preRegistrations: Array<{ id: string; name: string; loader: () => Promise<void> }> = [];

  register(id: string, name: string, pkg: StencilPackage) {
    pkg.subPackages?.forEach(sp =>
      sp.stencils.forEach(s => {
        s.id = id + STENCIL_ID_DELIMITER + sp.id + STENCIL_ID_DELIMITER + s.id;
      })
    );

    pkg.stencils.forEach(s => {
      s.id = id + STENCIL_ID_DELIMITER + s.id;
    });

    this.stencils.set(id, { id, name, ...pkg });
    this.loaded.add(id);

    this.emitAsyncWithDebounce('change', { stencilRegistry: this });
  }

  preRegister(id: string, name: string, loader: () => Promise<void>) {
    this.preRegistrations.push({ id, name, loader });
    this.stencils.set(id, { id, name, stencils: [], type: 'default' });
    this.emitAsyncWithDebounce('change', { stencilRegistry: this });

    setTimeout(() => this.loadStencilPackage(id), 10_000 + Math.random() * 30_000);
  }

  async loadStencilPackage(id: string) {
    const pr = this.preRegistrations.find(p => p.id === id);
    if (!pr) return;

    this.preRegistrations.splice(this.preRegistrations.indexOf(pr), 1);
    await pr.loader();
  }

  getStencil(id: string) {
    if (id.includes(STENCIL_ID_DELIMITER)) {
      const [pkgId] = safeSplit(id, STENCIL_ID_DELIMITER, 2);
      return getStencilsInPackage(this.get(pkgId)).find(s => s.id === id);
    } else {
      return this.stencils.values().flatMap(pkg => getStencilsInPackage(pkg)).find(s => s.id === id);
    }
  }

  get(id: string): StencilPackage {
    return this.stencils.get(id)!;
  }

  getStencils() {
    return [...this.stencils.values()];
  }

  async search(s: string): Promise<Stencil[]> {
    for (const pkg of this.stencils.values()) {
      await this.loadStencilPackage(pkg.id);
    }

    const results: Stencil[] = [];
    for (const pkg of this.stencils.values()) {
      const stencils = getStencilsInPackage(pkg);
      if (pkg.name.toLowerCase().includes(s.toLowerCase())) {
        results.push(...stencils);
      } else {
        for (const stencil of stencils) {
          if (stencil.name?.toLowerCase().includes(s.toLowerCase())) {
            results.push(stencil);
          }
        }
      }
    }
    return results;
  }
}

/* Helpers ************************************************************************** */

export const getStencilsInPackage = (pkg: StencilPackage): Array<Stencil> => {
  return [...pkg.stencils, ...(pkg.subPackages?.flatMap(subPackage => subPackage.stencils) ?? [])];
};

export const getStencilSubPackage = (
  pkg: StencilPackage,
  subpackageId: string
): StencilSubPackage => {
  return mustExist(pkg.subPackages?.find(p => p.id === subpackageId));
};

// TODO: Change signature such the pkg is the first argument
export const addStencilToSubpackage = (
  subpackage: string,
  pkg: StencilPackage,
  def: NodeDefinition | EdgeDefinition,
  opts?: Omit<MakeStencilNodeOpts, 'subPackage'>
) => {
  return addStencil(pkg, def, { ...opts, subPackage: subpackage });
};

export const addStencil = (
  pkg: StencilPackage,
  def: NodeDefinition | EdgeDefinition,
  opts?: MakeStencilNodeOpts
) => {
  const isNodeDef = 'getBoundingPath' in def;
  const stencil = {
    id: opts?.id ?? def.type,
    name: opts?.name ?? def.name,
    forPicker: isNodeDef
      ? StencilUtils.makeNode(def.type, 'picker', opts)
      : StencilUtils.makeEdge(def.type, 'picker', opts),
    forCanvas: isNodeDef
      ? StencilUtils.makeNode(def.type, 'canvas', opts)
      : StencilUtils.makeEdge(def.type, 'canvas', opts),
    type: pkg.type
  };

  if (opts?.subPackage) {
    getStencilSubPackage(pkg, opts.subPackage).stencils.push(stencil);
  } else {
    pkg.stencils.push(stencil);
  }
};

export const copyStyles = (target: Diagram, sourceDoc: DiagramDocument, uow: UnitOfWork) => {
  const targetDoc = target.document;
  const styles = sourceDoc.styles;
  const all = [...styles.nodeStyles, ...styles.edgeStyles, ...styles.textStyles];

  let changed = false;
  for (const style of all) {
    const existing = targetDoc.styles.get(style.id);
    if (existing) {
      if (deepEquals(existing.props, style.props)) continue;
      existing.setProps(style.props, uow);
      changed = true;
    } else {
      const snapshot = style.snapshot();
      targetDoc.styles.addStylesheet(
        style.id,
        Stylesheet.fromSnapshot(
          snapshot.type,
          snapshot,
          targetDoc.styles.crdt.factory,
          targetDoc.styles
        ),
        uow
      );
      changed = true;
    }
  }

  return changed;
};

export const stencilScaleStrokes = (stencil: Stencil) => {
  return stencil.settings?.scaleStrokes !== undefined
    ? stencil.settings?.scaleStrokes
    : stencil.type !== 'default' && stencil.type !== 'yaml';
};
