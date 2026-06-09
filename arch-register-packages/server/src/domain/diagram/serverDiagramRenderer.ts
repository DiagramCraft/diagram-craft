import { defaultEdgeRegistry, defaultNodeRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
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

    const viewBox = diagram.viewBox.svgViewboxString;

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
    return vnodeToString(vnode);
  } catch {
    return null;
  }
};
