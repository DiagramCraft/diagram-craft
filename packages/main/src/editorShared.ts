import { ToolConstructor, ToolType } from '@diagram-craft/canvas/tool';
import { MoveTool } from '@diagram-craft/canvas/tools/moveTool';
import { TextTool } from '@diagram-craft/canvas-app/tools/textTool';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { NodeTool } from '@diagram-craft/canvas/tools/nodeTool';
import { PenTool } from '@diagram-craft/canvas-app/tools/penTool';
import { FreehandTool } from '@diagram-craft/canvas-app/tools/freehandTool';
import { PanTool } from '@diagram-craft/canvas/tools/panTool';
import { RectTool } from '@diagram-craft/canvas-app/tools/rectTool';
import { ZoomTool } from '@diagram-craft/canvas-app/tools/zoomTool';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Application } from './application';
import { defaultAppActions, defaultMacAppKeymap } from './react-app/appActionMap';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { getDocumentTabKey } from './UserState';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import type { DialogCommand } from '@diagram-craft/canvas/context';

export const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  if ((e as any)._triggered) return;
  fn();
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  (e as any)._triggered = true;
};

export type DialogStackItem = {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  dialog: DialogCommand<any, any>;
  zIndex: number;
  id: string;
};

export const tools: Record<ToolType, ToolConstructor> = {
  move: MoveTool,
  text: TextTool,
  edge: EdgeTool,
  node: NodeTool,
  pen: PenTool,
  freehand: FreehandTool,
  pan: PanTool,
  rect: RectTool,
  zoom: ZoomTool
};

export const updateApplicationModel = (
  doc: DiagramDocument,
  app: Application,
  callback: ProgressCallback,
  onReady?: (app: Application) => void
) => {
  app.model.setActiveDocument(doc, app.awareness.state, callback);
  const savedDiagramId = app.userState.getDocumentTab(
    getDocumentTabKey(doc.url, doc.diagrams[0]?.id)
  );
  const initialDiagram =
    [...doc.diagramIterator({ nest: true })].find(d => d.id === doc.activeDiagramId) ??
    (savedDiagramId ? doc.byId(savedDiagramId) : undefined) ??
    doc.diagrams[0]!;

  app.model.activeDiagram = initialDiagram;

  if (!app.ready) {
    const keyMap = defaultMacAppKeymap;
    app.keyMap = keyMap;
    app.actions = makeActionMap(defaultAppActions)(app);
    onReady?.(app);
  }
  app.ready = true;
};
