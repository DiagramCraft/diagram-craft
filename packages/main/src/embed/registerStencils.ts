import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { stencilLoaderRegistry } from '@diagram-craft/model/stencilRegistry';
import { assert } from '@diagram-craft/utils/assert';
import type { StencilRegistryConfig } from '../appConfig';

/**
 * Pre-registers lazy stencil loaders for the packages a document is configured to use, so
 * stencils referenced by a diagram (but not included by default) can still be lazy-loaded
 * on demand. Extraction of the useEffect body in AppLoader.tsx.
 */
export const registerDocumentStencils = (
  doc: DiagramDocument,
  stencilConfig: StencilRegistryConfig
): void => {
  for (const def of stencilConfig) {
    if (doc.registry.stencils.getStencils().some(pkg => pkg.id === def.id)) continue;
    const typeLoader = stencilLoaderRegistry[def.loader];
    assert.present(typeLoader, `Stencil loader ${def.loader} not found`);

    doc.registry.stencils.preRegister(def.id, def.name, async () => {
      const stencilLoader = await typeLoader();
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      const pkg = await stencilLoader(doc.registry, def.opts as any);
      doc.registry.stencils.register(pkg.name ?? def.name, pkg, def.id === pkg.id ? [] : [def.id]);
    });
  }
};
