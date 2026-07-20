import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CanvasContextMenu } from './react-app/context-menu-dispatcher/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu-dispatcher/ContextMenuDispatcher';
import { GuideContextMenu } from './react-app/context-menu-dispatcher/GuideContextMenu';
import { SelectionContextMenu } from './react-app/context-menu-dispatcher/SelectionContextMenu';
import { LockedElementContextMenu } from './react-app/context-menu-dispatcher/LockedElementContextMenu';
import { ContextSpecificToolbar } from './react-app/toolbar/ContextSpecificToolbar';
import { useEventListener } from './react-app/hooks/useEventListener';
import { useRedraw } from './react-app/hooks/useRedraw';
import { DocumentTabs } from './react-app/DocumentTabs';
import { Ruler } from './react-app/Ruler';
import {
  ConfigurationContext,
  type ConfigurationContextType
} from './react-app/context/ConfigurationContext';
import { defaultPalette } from './react-app/toolwindow/ObjectToolWindow/components/palette';
import { LayerIndicator } from './react-app/LayerIndicator';
import {
  markStartOfNodeLinkPopup,
  NodeLinkPopup,
  NodeLinkPopupState
} from './react-app/NodeLinkPopup';
import type { NodeLinkOptions } from '@diagram-craft/model/stencilRegistry';
import { type UndoableAction } from '@diagram-craft/model/undoManager';
import { MessageDialog } from './react-app/components/MessageDialog';
import {
  canvasDragOverHandler,
  canvasDropHandler
} from './react-app/toolwindow/PickerToolWindow/PickerToolWindow.handlers';
import { Point } from '@diagram-craft/geometry/point';
import { EditableCanvas } from '@diagram-craft/canvas-react/EditableCanvas';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { HelpMessage } from './react-app/components/HelpMessage';
import { ErrorBoundary } from './react-app/ErrorBoundary';
import { newid } from '@diagram-craft/utils/id';
import {
  type ContextMenus,
  ContextMenuTarget,
  DialogCommand,
  Help
} from '@diagram-craft/canvas/context';
import { ImageInsertDialog } from './react-app/ImageInsertDialog';
import { TableInsertDialog } from './react-app/TableInsertDialog';
import { ReferenceLayerDialog } from './react-app/components/NewReferenceLayerDialog';
import { StringInputDialog } from './react-app/components/StringInputDialog';
import { RuleEditorDialog } from './react-app/components/RuleEditorDialog/RuleEditorDialog';
import { ModelCenterDialog } from './react-app/components/ModelCenterDialog/ModelCenterDialog';
import { useOnChange } from './react-app/hooks/useOnChange';
import { MainToolbar } from './react-app/MainToolbar';
import { AuxToolbar } from './react-app/AuxToolbar';
import { RightSidebar } from './react-app/RightSidebar';
import { LeftSidebar } from './react-app/LeftSidebar';
import { Application, ApplicationContext, ApplicationUIActions } from './application';
import { UserState } from './UserState';
import { CollaborationAwareness } from './CollaborationAwareness';
import { HelpState } from './react-app/HelpState';
import { JSONDialog } from './react-app/components/JSONDialog';
import { CanvasOutline } from './react-app/CanvasOutline';
import { CanvasTooltip } from './react-app/CanvasTooltip';
import { bindDocumentDragAndDrop } from '@diagram-craft/canvas/dragDropManager';
import { ExternalDataLinkDialog } from './react-app/components/ExternalDataLinkDialog';
import { Preview } from './react-app/Preview';
import { ShapeSelectDialog } from './react-app/ShapeSelectDialog';
import { SelectTemplateDialog } from './react-app/SelectTemplateDialog';
import { AwarenessToolbar } from './react-app/AwarenessToolbar';
import { CommentDialog } from './react-app/components/CommentDialog';
import { CommandPalette } from './react-app/components/CommandPalette';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';
import { TopBar } from '@diagram-craft/app-components/TopBar';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { LayoutTreeActionDialog } from './react-app/actions/layoutTreeAction.dialog';
import { AutoAlignActionDialog } from './react-app/actions/autoAlignAction.dialog';
import { LayoutForceDirectedActionDialog } from './react-app/actions/layoutForceDirectedAction.dialog';
import { LayoutLayeredActionDialog } from './react-app/actions/layoutLayeredAction.dialog';
import { LayoutOrthogonalActionDialog } from './react-app/actions/layoutOrthogonalAction.dialog';
import { LayoutSeriesParallelActionDialog } from './react-app/actions/layoutSeriesParallelAction.dialog';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { usePanOnDrag } from './react-app/hooks/usePanOnDrag';
import { NodeActionChooserDialog } from './react-app/components/NodeActionChooserDialog';
import { applyThemeMode, themeModeClassName } from './react-app/themeMode';
import { DocumentName } from './react-app/DocumentName';
import { oncePerEvent, tools, updateApplicationModel, type DialogStackItem } from './editorShared';

export type { DialogStackItem } from './editorShared';

export type FileActions = {
  loadDocument: (url: string) => Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: signature varies between standalone and embedded
  newDocument: (...args: any[]) => Promise<void>;
  clearDirty: () => void;
};

const defaultFileActions: FileActions = {
  loadDocument: async () => {
  },
  newDocument: async () => {
  },
  clearDirty: () => {
  }
};

const noopProgressCallback: ProgressCallback = () => {
};

const defaultConfiguration: ConfigurationContextType = {
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
};

export type EmbeddableEditorProps = {
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory;

  // Dirty state
  onDirtyChange?: (dirty: boolean) => void;
  dirty?: boolean;

  // Header customization
  documentName?: string;
  headerLeft?: React.ReactNode;

  // Wrapper
  wrapperClassName?: string | null;

  // Theming
  configuration?: ConfigurationContextType;

  // Application lifecycle
  application?: Application;
  onApplicationReady?: (app: Application) => void;

  // Behavior overrides
  fileActions?: FileActions;
  progressCallback?: ProgressCallback;
  onDiagramChange?: (event: unknown) => void;

  // Extension points
  extraDialogs?: (dialogStack: DialogStackItem[]) => React.ReactNode;
  overlay?: React.ReactNode;
};

export const EmbeddableEditor = (props: EmbeddableEditorProps) => {
  const redraw = useRedraw();
  const helpState = useRef(new HelpState());
  const [preview, setPreview] = useState<boolean>(false);
  const {
    onDirtyChange,
    documentName,
    dirty: externalDirty,
    headerLeft,
    wrapperClassName = 'dc dc-embeddable-editor',
    configuration = defaultConfiguration,
    onApplicationReady,
    fileActions = defaultFileActions,
    onDiagramChange: externalDiagramChange,
    extraDialogs,
    overlay
  } = props;

  const userState = useRef(UserState.get());
  const awareness = useRef<CollaborationAwareness | null>(null);
  const internalApplication = useRef<Application | null>(null);
  if (!internalApplication.current && !props.application) {
    awareness.current ??= new CollaborationAwareness();
    internalApplication.current = new Application(userState.current, awareness.current);
  }
  const application = props.application ?? internalApplication.current!;

  const effectiveProgressCallback = props.progressCallback ?? noopProgressCallback;

  useEventListener(application.model, 'activeDiagramChange', redraw);
  useEventListener(application.model, 'activeDocumentChange', redraw);
  useEventListener(userState.current, 'change', redraw);

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
    showNodeLinkPopup: (
      point: Point,
      nodeId: string | undefined,
      edgeId: string,
      pendingUndoableActions: UndoableAction[],
      options?: NodeLinkOptions
    ) => {
      markStartOfNodeLinkPopup(application.model.activeDiagram, pendingUndoableActions);

      const screenPoint = $d.viewBox.toScreenPoint(point);
      setPopoverState({
        isOpen: true,
        position: screenPoint,
        nodeId,
        edgeId,
        options
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
  application.ui = uiActions;
  application.help = help;
  application.file = fileActions;

  useOnChange(props.doc, () => {
    assert.arrayNotEmpty(props.doc.diagrams);
    updateApplicationModel(props.doc, application, effectiveProgressCallback, onApplicationReady);
  });

  const [dirty, setDirty] = useState(false);
  const [popoverState, setPopoverState] = useState<NodeLinkPopupState>(NodeLinkPopup.INITIAL_STATE);
  const [dialogStack, setDialogStack] = useState<DialogStackItem[]>([]);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const openDialogCount = useRef(0);

  const handleDialogShow = useCallback(() => {
    openDialogCount.current++;
    application.actionState.set('disabled');
  }, [application]);

  const handleDialogHide = useCallback(() => {
    openDialogCount.current--;
    if (openDialogCount.current === 0) {
      application.actionState.set('enabled');
    }
  }, [application]);

  // Internal dirty tracking — used when no external onDiagramChange is provided
  const internalDirtyTracking = useCallback(
    (event: unknown) => {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      if ((event as any).silent) return;
      if (!dirty) {
        setDirty(true);
        onDirtyChange?.(true);
      }
    },
    [dirty, onDirtyChange]
  );

  const changeHandler = externalDiagramChange ?? internalDirtyTracking;

  const $d = application.model.activeDiagram;
  const actionMap = application.actions;
  const doc = application.model.activeDocument;

  useEventListener($d, 'diagramChange', changeHandler);
  useEventListener($d, 'elementAdd', changeHandler);
  useEventListener($d, 'elementChange', changeHandler);
  useEventListener($d, 'elementRemove', changeHandler);
  useEventListener(doc, 'diagramRemoved', changeHandler);
  useEventListener(doc, 'diagramAdded', changeHandler);
  useEventListener(doc, 'diagramChanged', changeHandler);
  useEventListener(doc.data, 'change', changeHandler);
  useEventListener($d.commentManager, 'commentAdded', changeHandler);
  useEventListener($d.commentManager, 'commentUpdated', changeHandler);
  useEventListener($d.commentManager, 'commentRemoved', changeHandler);
  useEventListener(doc.data.db, 'updateData', changeHandler);
  useEventListener(doc.data.db, 'deleteData', changeHandler);
  useEventListener(doc.data.db, 'addData', changeHandler);
  useEventListener(doc.data.db, 'addSchema', changeHandler);
  useEventListener(doc.data.db, 'deleteSchema', changeHandler);
  useEventListener(doc.data.db, 'updateSchema', changeHandler);
  useEventListener(doc.props.query, 'change', changeHandler);
  useEventListener(doc.props.activeStencilPackages, 'change', changeHandler);

  useEffect(() => bindDocumentDragAndDrop());

  useLayoutEffect(() => {
    applyThemeMode(userState.current.effectiveTheme);
  });

  usePanOnDrag($d, userState.current!);

  const content = (
    <PortalContextProvider>
      <DialogContextProvider onDialogShow={handleDialogShow} onDialogHide={handleDialogHide}>
        <ApplicationContext.Provider value={{ application }}>
          {overlay}

          <ConfigurationContext.Provider value={configuration}>
            {/* Dialogs */}
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
              if (item.dialog.id !== 'nodeActionChooser') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <NodeActionChooserDialog
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
                  <CommandPalette open={true} onClose={() => item.dialog.onCancel?.()}/>
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
              if (item.dialog.id !== 'toolAutoAlign') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <AutoAlignActionDialog
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
            {dialogStack.map(item => {
              if (item.dialog.id !== 'toolLayoutLayered') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <LayoutLayeredActionDialog
                    onChange={d => item.dialog.props.onChange(d)}
                    onApply={d => item.dialog.onOk?.(d)}
                    onCancel={() => item.dialog.onCancel?.()}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'toolLayoutOrthogonal') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <LayoutOrthogonalActionDialog
                    onChange={d => item.dialog.props.onChange(d)}
                    onApply={d => item.dialog.onOk?.(d)}
                    onCancel={() => item.dialog.onCancel?.()}
                  />
                </div>
              );
            })}
            {dialogStack.map(item => {
              if (item.dialog.id !== 'toolLayoutSeriesParallel') return null;
              return (
                <div key={item.id} style={{ zIndex: item.zIndex }}>
                  <LayoutSeriesParallelActionDialog
                    onChange={d => item.dialog.props.onChange(d)}
                    onApply={d => item.dialog.onOk?.(d)}
                    onCancel={() => item.dialog.onCancel?.()}
                  />
                </div>
              );
            })}

            {extraDialogs?.(dialogStack)}

            <div id="app" className={themeModeClassName(userState.current.effectiveTheme)}>
              <TopBar
                id="menu"
                leftSlot={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {headerLeft}
                    <MainToolbar/>
                  </div>
                }
              >
                <DocumentName dirty={externalDirty ?? false} name={documentName}/>
                <div style={{ display: 'flex', marginLeft: 'auto' }}>
                  <AwarenessToolbar/>
                  <AuxToolbar/>
                </div>
              </TopBar>

              <div id="window-area">
                <div id="toolbar">
                  <ContextSpecificToolbar/>
                </div>

                <LeftSidebar/>
                <RightSidebar/>

                <div id="canvas-area">
                  <ErrorBoundary>
                    <ContextMenu.Root>
                      <ContextMenu.Trigger
                        element={
                          <EditableCanvas
                            id={CanvasDomHelper.diagramId($d)}
                            ref={svgRef}
                            diagram={$d}
                            key={$d.uid}
                            actionMap={actionMap}
                            tools={tools}
                            keyMap={application.keyMap}
                            offset={
                              (userState.current.panelLeft ?? -1) >= 0
                                ? {
                                  x: 250,
                                  y: 0
                                }
                                : Point.ORIGIN
                            }
                            onDrop={canvasDropHandler($d)}
                            onDragOver={canvasDragOverHandler($d)}
                            context={application}
                          />
                        }
                      />
                      <ContextMenu.Menu>
                        <ContextMenuDispatcher
                          state={contextMenuTarget}
                          createContextMenu={state => {
                            if (state.type === 'canvas') {
                              return (
                                <CanvasContextMenu target={state as ContextMenuTarget<'canvas'>}/>
                              );
                            } else if (state.type === 'selection') {
                              return (
                                <SelectionContextMenu
                                  target={state as ContextMenuTarget<'selection'>}
                                />
                              );
                            } else if (state.type === 'lockedElement') {
                              return (
                                <LockedElementContextMenu
                                  target={state as ContextMenuTarget<'lockedElement'>}
                                />
                              );
                            } else if (state.type === 'guide') {
                              return (
                                <GuideContextMenu target={state as ContextMenuTarget<'guide'>}/>
                              );
                            } else {
                              VERIFY_NOT_REACHED();
                            }
                          }}
                        />
                      </ContextMenu.Menu>
                    </ContextMenu.Root>
                  </ErrorBoundary>

                  <Ruler id="ruler-h" orientation={'horizontal'}/>
                  <Ruler id="ruler-v" orientation={'vertical'}/>
                  <CanvasOutline/>
                  <CanvasTooltip/>

                  <NodeLinkPopup
                    {...popoverState}
                    onClose={() => setPopoverState(s => ({ ...s, isOpen: false }))}
                  />
                </div>

                <div id="tabs">
                  <DocumentTabs document={doc}/>
                  <LayerIndicator/>
                </div>
              </div>

              <HelpMessage helpState={helpState.current}/>
            </div>

            {preview && <Preview onClose={() => setPreview(false)}/>}
          </ConfigurationContext.Provider>
        </ApplicationContext.Provider>
      </DialogContextProvider>
    </PortalContextProvider>
  );

  if (wrapperClassName != null) {
    return <div className={wrapperClassName}>{content}</div>;
  }

  return content;
};
