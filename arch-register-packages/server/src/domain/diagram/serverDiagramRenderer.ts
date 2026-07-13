import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { makeDefaultDiagramFactory } from '@diagram-craft/model/diagramDocumentFactory';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { StencilRegistry } from '@diagram-craft/model/stencilRegistry';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { StaticCanvasComponent } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { Observable } from '@diagram-craft/canvas/component/component';
import { Marquee } from '@diagram-craft/canvas/marquee';
import { model } from '@diagram-craft/canvas/modelState';
import type { Context } from '@diagram-craft/canvas/context';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { blobToDataURL } from '@diagram-craft/utils/blobUtils';
import { vnodeToString } from './vnodeSerializer';
import type { ToolType } from '@diagram-craft/canvas/tool';

// Minimal stub Context for server-side rendering.
// Only `tool.get()` might be called during render() and only when a node is
// single-selected — which never happens during SSR since there is no selection.
const ssrContext: Context = {
  model,
  tool: new Observable<ToolType>('move'),
  actionState: new Observable<'enabled' | 'disabled'>('enabled'),
  ui: {
    showContextMenu: () => {},
    showNodeLinkPopup: () => {},
    showDialog: () => {}
  },
  help: { set: () => {}, push: () => {}, pop: () => {} },
  actions: {},
  marquee: new Marquee()
};

// Reuse the registry across renders — constructing it is expensive.
let _nodeRegistry: ReturnType<typeof defaultNodeRegistry> | undefined;
let _edgeRegistry: ReturnType<typeof defaultEdgeRegistry> | undefined;

const getRegistry = () => {
  _nodeRegistry ??= defaultNodeRegistry();
  _edgeRegistry ??= defaultEdgeRegistry();
  return {
    nodes: _nodeRegistry,
    edges: _edgeRegistry,
    stencils: new StencilRegistry()
  };
};

const inlineBlobUrls = async (svg: string): Promise<string> => {
  const urls = [...new Set(svg.match(/blob:nodedata:[0-9a-f-]+/g) ?? [])];
  const replacements = await Promise.all(
    urls.map(async url => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to read server-rendered attachment: ${response.status}`);
      }

      return [url, await blobToDataURL(await response.blob())] as const;
    })
  );

  return replacements.reduce((result, [url, dataUrl]) => result.replaceAll(url, dataUrl), svg);
};

/**
 * Generates an accurate SVG preview by running the full diagram-craft rendering
 * pipeline (deserialize → StaticCanvasComponent → VNode serializer).
 *
 * Returns null if the document is empty or rendering fails.
 */
export const generateAccurateSvgPreview = async (
  doc: SerializedDiagramDocument
): Promise<string | null> => {
  try {
    const registry = getRegistry();
    const diagramDoc = new DiagramDocument(registry, false, new NoOpCRDTRoot());

    await deserializeDiagramDocument(doc, diagramDoc, makeDefaultDiagramFactory());

    if (diagramDoc.diagrams.length === 0) return null;

    const diagram = diagramDoc.diagrams[0]!;

    // Check if there are any elements to render
    const hasElements = diagram.layers.visible.some(layer => {
      const resolved = layer.resolve();
      return resolved && 'elements' in resolved && resolved.elements.length > 0;
    });

    if (!hasElements) return null;

    // Use canvas bounds directly for stable preview viewBox
    // Don't use diagram.viewBox.svgViewboxString as it may have padding applied
    const bounds = diagram.bounds;
    const viewBox = `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`;

    const props = {
      id: 'ssr-preview',
      diagram,
      context: ssrContext,
      width: 800,
      height: 600,
      viewbox: viewBox
    };

    // Pass props to constructor so this.currentProps is set before render() is called,
    // as BaseCanvasComponent.renderLayer() accesses this.currentProps directly.
    const component = new StaticCanvasComponent(props);
    const vnode = component.render(props);
    return await inlineBlobUrls(vnodeToString(vnode));
  } catch {
    return null;
  }
};
