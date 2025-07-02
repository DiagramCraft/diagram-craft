import './App.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { CanvasContextMenu } from './react-app/context-menu-dispatcher/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu-dispatcher/ContextMenuDispatcher';
import { SelectionContextMenu } from './react-app/context-menu-dispatcher/SelectionContextMenu';
import { ContextSpecificToolbar } from './react-app/toolbar/ContextSpecificToolbar';
import { EdgeContextMenu } from './react-app/context-menu-dispatcher/EdgeContextMenu';
import { useEventListener } from './react-app/hooks/useEventListener';
import { useRedraw } from './react-app/hooks/useRedraw';
import { defaultAppActions, defaultMacAppKeymap } from './react-app/appActionMap';
import { DocumentTabs } from './react-app/DocumentTabs';
import { Ruler } from './react-app/Ruler';
import { ConfigurationContext } from './react-app/context/ConfigurationContext';
import { defaultPalette } from './react-app/toolwindow/ObjectToolWindow/components/palette';
import { LayerIndicator } from './react-app/LayerIndicator';
import { NodeTypePopup, NodeTypePopupState } from './react-app/NodeTypePopup';
import { MessageDialog } from './react-app/components/MessageDialog';
import {
  canvasDragOverHandler,
  canvasDropHandler
} from './react-app/toolwindow/PickerToolWindow/PickerToolWindow.handlers';
import { Point } from '@diagram-craft/geometry/point';
import { ToolConstructor, ToolType } from '@diagram-craft/canvas/tool';
import { MoveTool } from '@diagram-craft/canvas/tools/moveTool';
import { TextTool } from '@diagram-craft/canvas-app/tools/textTool';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { NodeTool } from '@diagram-craft/canvas/tools/nodeTool';
import { PenTool } from '@diagram-craft/canvas-app/tools/penTool';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { EditableCanvas } from '@diagram-craft/canvas-react/EditableCanvas';
import { Autosave } from './Autosave';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { HelpMessage } from './react-app/components/HelpMessage';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { ErrorBoundary } from './react-app/ErrorBoundary';
import { FreehandTool } from '@diagram-craft/canvas-app/tools/freehandTool';
import { PanTool } from '@diagram-craft/canvas-app/tools/panTool';
import { FileDialog } from './react-app/FileDialog';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ContextMenuTarget, DialogCommand, Help, UIActions } from '@diagram-craft/canvas/context';
import { ImageInsertDialog } from './react-app/ImageInsertDialog';
import { TableInsertDialog } from './react-app/TableInsertDialog';
import { RectTool } from '@diagram-craft/canvas-app/tools/rectTool';
import { ReferenceLayerDialog } from './react-app/components/NewReferenceLayerDialog';
import { StringInputDialog } from './react-app/components/StringInputDialog';
import { RuleEditorDialog } from './react-app/components/RuleEditorDialog/RuleEditorDialog';
import { useOnChange } from './react-app/hooks/useOnChange';
import { MainMenu } from './react-app/MainMenu';
import { MainToolbar } from './react-app/MainToolbar';
import { AuxToolbar } from './react-app/AuxToolbar';
import { RightSidebar } from './react-app/RightSidebar';
import { LeftSidebar } from './react-app/LeftSidebar';
import { Application, ApplicationContext, ApplicationUIActions } from './application';
import { UserState } from './UserState';
import { HelpState } from './react-app/HelpState';
import { JSONDialog } from './react-app/components/JSONDialog';
import { CanvasOutline } from './react-app/CanvasOutline';
import { bindDocumentDragAndDrop } from '@diagram-craft/canvas/dragDropManager';
import { ExternalDataLinkDialog } from './react-app/components/ExternalDataLinkDialog';
import { Preview } from './react-app/Preview';
import { ShapeSelectDialog } from './react-app/ShapeSelectDialog';
import { ZoomTool } from '@diagram-craft/canvas-app/tools/zoomTool';
import { AwarenessToolbar } from './react-app/AwarenessToolbar';
import { Progress, ProgressCallback } from '@diagram-craft/model/types';
import { FullScreenProgress } from './react-app/components/FullScreenProgress';

const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // eslint-disable-next-line
  if ((e as any)._triggered) return;
  fn();
  // eslint-disable-next-line
  (e as any)._triggered = true;
};

const tools: Record<ToolType, ToolConstructor> = {
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

export type DiagramRef = {
  name?: string;
  url: string;
};

const updateApplicationModel = ($d: Diagram, app: Application, callback: ProgressCallback) => {
  app.model.setActiveDocument($d.document, callback);
  app.model.activeDiagram = $d;
  if (!app.ready) {
    app.actions = makeActionMap(defaultAppActions)(app);
  }
  app.ready = true;
};

export const App = (props: {
  url?: string;
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory<Diagram>;
}) => {
  const redraw = useRedraw();
  const helpState = useRef(new HelpState());
  const [preview, setPreview] = useState<boolean>(false);

  const userState = useRef(new UserState());
  const application = useRef(new Application(userState.current));

  const [progress, setProgress] = useState<Progress | undefined>(undefined);
  const progressCallback = useCallback<ProgressCallback>(
    (status, opts) => queueMicrotask(() => setProgress({ status, ...opts })),
    [setProgress]
  );

  useEventListener(application.current.model, 'activeDiagramChange', redraw);
  useEventListener(application.current.model, 'activeDocumentChange', redraw);

  const help: Help = {
    push: (id: string, message: string) => {
      const help = helpState.current.help;
      if (help && help.id === id && help.message === message) return;
      queueMicrotask(() => {
        helpState.current.pushHelp({ id, message });
      });
    },
    pop: (id: string) => {
      helpState.current.popHelp(id);
    },
    set: (message: string) => {
      helpState.current.setHelp({ id: 'default', message });
    }
  };

  const uiActions: ApplicationUIActions = {
    showContextMenu: <T extends keyof UIActions.ContextMenus>(
      type: T,
      point: Point,
      mouseEvent: MouseEvent,
      args: UIActions.ContextMenus[T]
    ) => {
      oncePerEvent(mouseEvent, () => {
        contextMenuTarget.current = { type, ...args, pos: point };
      });
    },
    showNodeLinkPopup: (point: Point, sourceNodeId: string, edgId: string) => {
      const screenPoint = $d.viewBox.toScreenPoint(point);
      setPopoverState({
        isOpen: true,
        position: screenPoint,
        nodeId: sourceNodeId,
        edgeId: edgId
      });
    },
    showDialog: (dialog: DialogCommand<unknown, unknown>) => {
      setDialogState({
        ...dialog,
        onOk: (data: unknown) => {
          dialog.onOk(data);
          setDialogState(undefined);
        },
        onCancel: () => {
          dialog.onCancel?.();
          setDialogState(undefined);
        }
      });
    },
    showPreview: () => setPreview(true)
  };
  application.current.ui = uiActions;
  application.current.help = help;

  application.current.file = {
    loadDocument: async (url: string) => {
      const doc = await loadFileFromUrl(
        url,
        progressCallback,
        props.documentFactory,
        props.diagramFactory
      );
      doc.url = url;

      updateApplicationModel(doc.topLevelDiagrams[0], application.current, progressCallback);

      Autosave.clear();
      setDirty(false);

      userState.current.addRecentFile(url);
    },
    newDocument: async () => {
      // TODO: This is partially duplicated in AppLoader.ts
      const doc = await props.documentFactory(undefined, progressCallback);
      const diagram = new Diagram(newid(), 'Untitled', doc);
      diagram.layers.add(
        new RegularLayer(newid(), 'Default', [], diagram),
        UnitOfWork.immediate(diagram)
      );
      doc.addDiagram(diagram);

      updateApplicationModel(diagram, application.current, progressCallback);

      Autosave.clear();
      setDirty(false);
    },
    clearDirty: () => {
      Autosave.clear();
      setDirty(false);
    }
  };

  useOnChange(props.doc, () => {
    updateApplicationModel(props.doc.topLevelDiagrams[0], application.current, progressCallback);
  });

  const [dirty, setDirty] = useState(Autosave.exists());
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dialogState, setDialogState] = useState<DialogCommand<any, any> | undefined>(undefined);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (props.url) userState.current.addRecentFile(props.url);
  }, [props.url]);

  // TODO: Can we change this to use state instead - see https://stackoverflow.com/questions/59600572/how-to-rerender-when-refs-change
  //       Can be tested if ruler indicators work at startup immediately or not
  useEffect(() => {
    redraw();
  }, [svgRef.current]);

  const $d = application.current.model.activeDiagram;
  const actionMap = application.current.actions;
  const doc = application.current.model.activeDocument;
  const url = application.current.model.activeDocument.url;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autosave = (event: any) => {
    if (event.silent) return;

    Autosave.asyncSave(url, doc);
    setDirty(true);
  };

  useEventListener($d, 'change', autosave);
  useEventListener($d, 'elementAdd', autosave);
  useEventListener($d, 'elementChange', autosave);
  useEventListener($d, 'elementRemove', autosave);
  useEventListener(doc, 'diagramremoved', autosave);
  useEventListener(doc, 'diagramadded', autosave);
  useEventListener(doc, 'diagramchanged', autosave);
  useEventListener(doc.data, 'change', autosave);

  useEffect(() => bindDocumentDragAndDrop());

  const keyMap = defaultMacAppKeymap;
  application.current.keyMap = keyMap;

  return (
    <ApplicationContext.Provider value={{ application: application.current }}>
      {progress === undefined ||
        (progress?.status !== 'complete' && (
          <FullScreenProgress
            message={progress?.message ?? ''}
            isError={progress?.status === 'error'}
          />
        ))}

      <ConfigurationContext.Provider
        value={{
          palette: {
            primary: defaultPalette
          },
          fonts: {
            'Times': 'Times',
            'Arial': 'Arial',
            'Sans Serif': 'sans-serif',
            'Helvetica': 'Helvetica',
            'Verdana': 'Verdana',
            'Courier': 'Courier',
            'Comic Sans': 'Comic Sans MS',
            'Impact': 'Impact',
            'Tahoma': 'Tahoma',
            'Trebuchet': 'Trebuchet MS',
            'Georgia': 'Georgia'
          }
        }}
      >
        {/* Dialogs */}
        <FileDialog
          open={dialogState?.id === 'fileOpen'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <ImageInsertDialog
          open={dialogState?.id === 'imageInsert'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <TableInsertDialog
          open={dialogState?.id === 'tableInsert'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <ReferenceLayerDialog
          open={dialogState?.id === 'newReferenceLayer'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <StringInputDialog
          open={dialogState?.id === 'stringInput'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <RuleEditorDialog
          open={dialogState?.id === 'ruleEditor'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <MessageDialog
          open={dialogState?.id === 'message'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <JSONDialog
          open={dialogState?.id === 'json'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <ExternalDataLinkDialog
          open={dialogState?.id === 'externalDataLink'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />
        <ShapeSelectDialog
          open={dialogState?.id === 'shapeSelect'}
          {...dialogState?.props}
          onOk={dialogState?.onOk}
          onCancel={dialogState?.onCancel}
        />

        <div id="app" className={'dark-theme'}>
          <div id="menu">
            <MainMenu />
            <MainToolbar dirty={dirty} />
            <AwarenessToolbar />
            <AuxToolbar />
          </div>

          <div id="window-area">
            <div id="toolbar">
              <ContextSpecificToolbar />
            </div>

            <LeftSidebar />
            <RightSidebar />

            <div id="canvas-area" className={'light-theme'}>
              <ErrorBoundary>
                <ContextMenu.Root>
                  <ContextMenu.Trigger asChild={true}>
                    <EditableCanvas
                      id={`diagram-${$d.id}`}
                      ref={svgRef}
                      diagram={$d}
                      /* Note: this uid here to force redraw in case the diagram is reloaded */
                      key={$d.uid}
                      actionMap={actionMap}
                      tools={tools}
                      keyMap={keyMap}
                      offset={
                        (userState.current.panelLeft ?? -1) >= 0
                          ? {
                              x: 250, // Corresponding to left panel width
                              y: 0
                            }
                          : Point.ORIGIN
                      }
                      onDrop={canvasDropHandler($d)}
                      onDragOver={canvasDragOverHandler($d)}
                      context={application.current}
                    />
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content className="cmp-context-menu">
                      <ContextMenuDispatcher
                        state={contextMenuTarget}
                        createContextMenu={state => {
                          if (state.type === 'canvas') {
                            return (
                              <CanvasContextMenu target={state as ContextMenuTarget<'canvas'>} />
                            );
                          } else if (state.type === 'selection') {
                            return <SelectionContextMenu />;
                          } else {
                            return <EdgeContextMenu target={state as ContextMenuTarget<'edge'>} />;
                          }
                        }}
                      />
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              </ErrorBoundary>

              <Ruler orientation={'horizontal'} />
              <Ruler orientation={'vertical'} />
              <CanvasOutline />

              <NodeTypePopup
                {...popoverState}
                onClose={() => setPopoverState(NodeTypePopup.INITIAL_STATE)}
              />
            </div>

            <div id="tabs">
              <DocumentTabs document={doc} />

              <LayerIndicator />
            </div>
          </div>

          <HelpMessage helpState={helpState.current} />
        </div>

        {preview && <Preview onClose={() => setPreview(false)} />}
      </ConfigurationContext.Provider>
    </ApplicationContext.Provider>
  );
};
