import './App.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { CanvasContextMenu } from './react-app/context-menu-dispatcher/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu-dispatcher/ContextMenuDispatcher';
import { SelectionContextMenu } from './react-app/context-menu-dispatcher/SelectionContextMenu';
import { ContextSpecificToolbar } from './react-app/toolbar/ContextSpecificToolbar';
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
import { Extent } from '@diagram-craft/geometry/extent';
import { ToolConstructor, ToolType } from '@diagram-craft/canvas/tool';
import { MoveTool } from '@diagram-craft/canvas/tools/moveTool';
import { TextTool } from '@diagram-craft/canvas-app/tools/textTool';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { NodeTool } from '@diagram-craft/canvas/tools/nodeTool';
import { PenTool } from '@diagram-craft/canvas-app/tools/penTool';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { EditableCanvas } from '@diagram-craft/canvas-react/EditableCanvas';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { HelpMessage } from './react-app/components/HelpMessage';
import { Diagram } from '@diagram-craft/model/diagram';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { ErrorBoundary } from './react-app/ErrorBoundary';
import { FreehandTool } from '@diagram-craft/canvas-app/tools/freehandTool';
import { PanTool } from '@diagram-craft/canvas-app/tools/panTool';
import { FileDialog } from './react-app/FileDialog';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  type ContextMenus,
  ContextMenuTarget,
  DialogCommand,
  Help
} from '@diagram-craft/canvas/context';
import { ImageInsertDialog } from './react-app/ImageInsertDialog';
import { TableInsertDialog } from './react-app/TableInsertDialog';
import { RectTool } from '@diagram-craft/canvas-app/tools/rectTool';
import { ReferenceLayerDialog } from './react-app/components/NewReferenceLayerDialog';
import { StringInputDialog } from './react-app/components/StringInputDialog';
import { RuleEditorDialog } from './react-app/components/RuleEditorDialog/RuleEditorDialog';
import { ModelCenterDialog } from './react-app/components/ModelCenterDialog/ModelCenterDialog';
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
import { CanvasTooltip } from './react-app/CanvasTooltip';
import { bindDocumentDragAndDrop } from '@diagram-craft/canvas/dragDropManager';
import { ExternalDataLinkDialog } from './react-app/components/ExternalDataLinkDialog';
import { Preview } from './react-app/Preview';
import { ShapeSelectDialog } from './react-app/ShapeSelectDialog';
import { SelectTemplateDialog } from './react-app/SelectTemplateDialog';
import { ZoomTool } from '@diagram-craft/canvas-app/tools/zoomTool';
import { AwarenessToolbar } from './react-app/AwarenessToolbar';
import { CommentDialog } from './react-app/components/CommentDialog';
import { CommandPalette } from './react-app/components/CommandPalette';
import { FullScreenProgress } from './react-app/components/FullScreenProgress';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';
import { ElectronIntegration } from './electron';
import { DocumentName } from './react-app/DocumentName';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Autosave } from './react-app/autosave/Autosave';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import type { Progress, ProgressCallback } from '@diagram-craft/utils/progress';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { LayoutTreeActionDialog } from './react-app/actions/layoutTreeAction.dialog';
import { LayoutForceDirectedActionDialog } from './react-app/actions/layoutForceDirectedAction.dialog';

const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  if ((e as any)._triggered) return;
  fn();
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  (e as any)._triggered = true;
};

type DialogStackItem = {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  dialog: DialogCommand<any, any>;
  zIndex: number;
  id: string;
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
  app.model.setActiveDocument($d.document, app.userState.awarenessState, callback);
  app.model.activeDiagram = $d;

  if (!app.ready) {
    const keyMap = defaultMacAppKeymap;
    app.keyMap = keyMap;
    app.actions = makeActionMap(defaultAppActions)(app);
    ELECTRON: {
      if (window.electronAPI) {
        ElectronIntegration.bindActions(app);
      }
    }
  }
  app.ready = true;
};

export const App = (props: {
  url?: string;
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory;
}) => {
  const redraw = useRedraw();
  const helpState = useRef(new HelpState());
  const [preview, setPreview] = useState<boolean>(false);

  const userState = useRef(new UserState());
  const application = useRef(new Application(userState.current));

  const [progress, setProgress] = useState<Progress | undefined>(undefined);
  const progressCallback = useCallback<ProgressCallback>(
    (status, opts) => queueMicrotask(() => setProgress({ status, ...opts })),
    []
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
    showContextMenu: <T extends keyof ContextMenus>(
      type: T,
      point: Point,
      mouseEvent: MouseEvent,
      args: ContextMenus[T]
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
      const dialogId = newid();
      const baseZIndex = 1000;
      const newZIndex = baseZIndex + dialogStack.length;

      setDialogStack(prev => [
        ...prev,
        {
          dialog: {
            ...dialog,
            onOk: (data: unknown) => {
              dialog.onOk(data);
              setDialogStack(current => current.filter(item => item.id !== dialogId));
            },
            onCancel: () => {
              dialog.onCancel?.();
              setDialogStack(current => current.filter(item => item.id !== dialogId));
            }
          },
          zIndex: newZIndex,
          id: dialogId
        }
      ]);
    },
    showPreview: () => setPreview(true)
  };
  application.current.ui = uiActions;
  application.current.help = help;

  application.current.file = {
    loadDocument: async (url: string) => {
      const doc = await loadFileFromUrl(
        url,
        UserState.get().awarenessState,
        progressCallback,
        props.documentFactory,
        props.diagramFactory
      );
      doc.url = url;

      assert.arrayNotEmpty(doc.diagrams);
      updateApplicationModel(doc.diagrams[0], application.current, progressCallback);

      Autosave.get().clear();
      setDirty(false);
      setHash(doc.hash);

      userState.current.addRecentFile(url);
    },
    newDocument: async (size?: Extent, offset?: Point) => {
      // TODO: This is partially duplicated in AppLoader.ts
      const doc = await props.documentFactory.createDocument(
        await props.documentFactory.loadCRDT(
          undefined,
          UserState.get().awarenessState,
          progressCallback
        ),
        undefined,
        progressCallback
      );
      const diagram = new Diagram(newid(), 'Untitled', doc, undefined, size, offset);
      diagram.layers.add(
        new RegularLayer(newid(), 'Default', [], diagram),
        UnitOfWork.immediate(diagram)
      );
      doc.addDiagram(diagram);

      updateApplicationModel(diagram, application.current, progressCallback);

      Autosave.get().clear();
      setDirty(false);
      setHash(doc.hash);
    },
    clearDirty: () => {
      Autosave.get().clear();
      setDirty(false);
      setHash(application.current.model.activeDocument.hash);
    }
  };

  useOnChange(props.doc, () => {
    assert.arrayNotEmpty(props.doc.diagrams);
    updateApplicationModel(props.doc.diagrams[0], application.current, progressCallback);
  });

  const [dirty, setDirty] = useState(false);
  const [hash, setHash] = useState(application.current.model.activeDocument.hash);
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  const [dialogStack, setDialogStack] = useState<DialogStackItem[]>([]);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const openDialogCount = useRef(0);

  const handleDialogShow = useCallback(() => {
    openDialogCount.current++;
    application.current.actionState.set('disabled');
  }, []);

  const handleDialogHide = useCallback(() => {
    openDialogCount.current--;
    if (openDialogCount.current === 0) {
      application.current.actionState.set('enabled');
    }
  }, []);

  useEffect(() => {
    if (props.url) userState.current.addRecentFile(props.url);
  }, [props.url]);

  // Check initial autosave state
  useEffect(() => {
    Autosave.get()
      .exists()
      .then(setDirty)
      .catch(() => setDirty(false));
  }, []);

  // TODO: Can we change this to use state instead - see https://stackoverflow.com/questions/59600572/how-to-rerender-when-refs-change
  //       Can be tested if ruler indicators work at startup immediately or not
  // biome-ignore lint/correctness/useExhaustiveDependencies: this is correct
  useEffect(() => {
    redraw();
  }, [svgRef.current, redraw]);

  const $d = application.current.model.activeDiagram;
  const actionMap = application.current.actions;
  const doc = application.current.model.activeDocument;
  const url = application.current.model.activeDocument.url;

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  const autosave = (event: any) => {
    if (event.silent) return;

    Autosave.get().asyncSave(url, doc, s => {
      setDirty(s.hash !== hash);
    });
    setDirty(true);
  };

  useEventListener($d, 'diagramChange', autosave);
  useEventListener($d, 'elementAdd', autosave);
  useEventListener($d, 'elementChange', autosave);
  useEventListener($d, 'elementRemove', autosave);
  useEventListener(doc, 'diagramRemoved', autosave);
  useEventListener(doc, 'diagramAdded', autosave);
  useEventListener(doc, 'diagramChanged', autosave);
  useEventListener(doc.data, 'change', autosave);
  useEventListener($d.commentManager, 'commentAdded', autosave);
  useEventListener($d.commentManager, 'commentUpdated', autosave);
  useEventListener($d.commentManager, 'commentRemoved', autosave);
  useEventListener(doc.data, 'change', autosave);
  useEventListener(doc.data.db, 'updateData', autosave);
  useEventListener(doc.data.db, 'deleteData', autosave);
  useEventListener(doc.data.db, 'addData', autosave);
  useEventListener(doc.data.db, 'addSchema', autosave);
  useEventListener(doc.data.db, 'deleteSchema', autosave);
  useEventListener(doc.data.db, 'updateSchema', autosave);
  useEventListener(doc.props.query, 'change', autosave);

  useEffect(() => bindDocumentDragAndDrop());

  return (
    <PortalContextProvider>
      <DialogContextProvider onDialogShow={handleDialogShow} onDialogHide={handleDialogHide}>
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
            {dialogStack.map(item => {
              if (item.dialog.id !== 'fileOpen') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <FileDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'fileSaveAs') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <FileDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'imageInsert') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <ImageInsertDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'tableInsert') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <TableInsertDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'newReferenceLayer') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <ReferenceLayerDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'stringInput') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <StringInputDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'ruleEditor') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <RuleEditorDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'message') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <MessageDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'json') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <JSONDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'externalDataLink') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <ExternalDataLinkDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'modelCenter') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <ModelCenterDialog
                    open={true}
                    onClose={() => item.dialog.onCancel?.()}
                    defaultTab={item.dialog.props?.defaultTab}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'shapeSelect') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <ShapeSelectDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'selectTemplate') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <SelectTemplateDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'comment') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <CommentDialog
                    open={true}
                    {...item.dialog.props}
                    onOk={item.dialog.onOk}
                    onCancel={item.dialog.onCancel}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'commandPalette') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <CommandPalette open={true} onClose={() => item.dialog.onCancel?.()} />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'toolLayoutTree') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <LayoutTreeActionDialog
                    onChange={d => item.dialog.props.onChange(d)}
                    onApply={d => item.dialog.onOk?.(d)}
                    onCancel={() => item.dialog.onCancel?.()}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'toolLayoutForceDirected') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <LayoutForceDirectedActionDialog
                    onChange={d => item.dialog.props.onChange(d)}
                    onApply={d => item.dialog.onOk?.(d)}
                    onCancel={() => item.dialog.onCancel?.()}
                  />
                </div>
              );
            })}

            <div id="app" className={'dark-theme'}>
              <div id="menu">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <MainMenu />
                  <MainToolbar />
                </div>
                <DocumentName dirty={dirty} />
                <div style={{ display: 'flex', marginLeft: 'auto' }}>
                  <AwarenessToolbar />
                  <AuxToolbar />
                </div>
              </div>

              <div id="window-area">
                <div id="toolbar">
                  <ContextSpecificToolbar />
                </div>

                <LeftSidebar />
                <RightSidebar />

                <div id="canvas-area">
                  <ErrorBoundary>
                    <ContextMenu.Root>
                      <ContextMenu.Trigger asChild={true}>
                        <EditableCanvas
                          id={CanvasDomHelper.diagramId($d)}
                          ref={svgRef}
                          diagram={$d}
                          /* Note: this uid here to force redraw in case the diagram is reloaded */
                          key={$d.uid}
                          actionMap={actionMap}
                          tools={tools}
                          keyMap={application.current.keyMap}
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
                                  <CanvasContextMenu
                                    target={state as ContextMenuTarget<'canvas'>}
                                  />
                                );
                              } else if (state.type === 'selection') {
                                return (
                                  <SelectionContextMenu
                                    target={state as ContextMenuTarget<'selection'>}
                                  />
                                );
                              } else {
                                VERIFY_NOT_REACHED();
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
                  <CanvasTooltip />

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
      </DialogContextProvider>
    </PortalContextProvider>
  );
};
