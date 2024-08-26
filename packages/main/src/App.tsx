import './App.css';
import { useEffect, useRef, useState } from 'react';
import { LayerToolWindow } from './react-app/toolwindow/LayerToolWindow/LayerToolWindow';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import {
  TbCheck,
  TbChevronRight,
  TbDatabaseEdit,
  TbFile,
  TbHelpSquare,
  TbHistory,
  TbInfoCircle,
  TbLine,
  TbLocation,
  TbMenu2,
  TbMoon,
  TbPalette,
  TbPencil,
  TbPentagonPlus,
  TbPhotoPlus,
  TbPlus,
  TbPointer,
  TbPolygon,
  TbSearch,
  TbSquarePlus2,
  TbStack,
  TbSun,
  TbTablePlus,
  TbTextSize,
  TbZoomIn,
  TbZoomOut
} from 'react-icons/tb';
import { CanvasContextMenu } from './react-app/context-menu-dispatcher/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu-dispatcher/ContextMenuDispatcher';
import { SelectionContextMenu } from './react-app/context-menu-dispatcher/SelectionContextMenu';
import { ContextSpecificToolbar } from './react-app/toolbar/ContextSpecificToolbar';
import { SideBar, SideBarPage } from './react-app/SideBar';
import { PickerToolWindow } from './react-app/toolwindow/PickerToolWindow/PickerToolWindow';
import { ObjectToolWindow } from './react-app/toolwindow/ObjectToolWindow/ObjectToolWindow';
import { EdgeContextMenu } from './react-app/context-menu-dispatcher/EdgeContextMenu';
import { useEventListener } from './react-app/hooks/useEventListener';
import { useRedraw } from './react-app/hooks/useRedraw';
import { defaultAppActions, defaultMacAppKeymap } from './react-app/appActionMap';
import { ObjectInfoToolWindow } from './react-app/toolwindow/ObjectInfoToolWindow/ObjectInfoToolWindow';
import { DocumentTabs } from './react-app/DocumentTabs';
import { HistoryToolWindow } from './react-app/toolwindow/HistoryToolWindow/HistoryToolWindow';
import { Ruler } from './react-app/Ruler';
import { ActionsContext, useActions } from './react-app/context/ActionsContext';
import { DiagramContext } from './react-app/context/DiagramContext';
import { ConfigurationContext } from './react-app/context/ConfigurationContext';
import { defaultPalette } from './react-app/toolwindow/ObjectToolWindow/components/palette';
import { DocumentToolWindow } from './react-app/toolwindow/DocumentToolWindow/DocumentToolWindow';
import { ActionToggleButton } from './react-app/toolbar/ActionToggleButton';
import { LayerIndicator } from './react-app/LayerIndicator';
import { NodeTypePopup, NodeTypePopupState } from './react-app/NodeTypePopup';
import { MessageDialog, MessageDialogState } from './react-app/components/MessageDialog';
import { ObjectDataToolWindow } from './react-app/toolwindow/ObjectDataToolWindow/ObjectDataToolWindow';
import { QueryToolWindow } from './react-app/toolwindow/QueryToolWindow/QueryToolWindow';
import {
  canvasDragOverHandler,
  canvasDropHandler
} from './react-app/toolwindow/PickerToolWindow/PickerToolWindow.handlers';
import { Point } from '@diagram-craft/geometry/point';
import { ToolContructor } from '@diagram-craft/canvas/tool';
import { MoveTool } from '@diagram-craft/canvas/tools/moveTool';
import { TextTool } from '@diagram-craft/canvas-app/tools/textTool';
import { EdgeTool } from '@diagram-craft/canvas-app/tools/edgeTool';
import { NodeTool } from '@diagram-craft/canvas/tools/nodeTool';
import { PenTool } from '@diagram-craft/canvas-app/tools/penTool';
import { ApplicationState, ToolType } from '@diagram-craft/canvas/ApplicationState';
import { UserState } from '@diagram-craft/canvas/UserState';
import { makeActionMap } from '@diagram-craft/canvas/keyMap';
import { EditableCanvas } from '@diagram-craft/canvas-react/EditableCanvas';
import { edgeDefaults, nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Autosave } from './Autosave';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { HelpMessage } from './react-app/components/HelpMessage';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DirtyIndicator } from './react-app/DirtyIndicator';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { ErrorBoundary } from './react-app/ErrorBoundary';
import { SelectToolWindow } from './react-app/toolwindow/SelectToolWindow/SelectToolWindow';
import { FreehandTool } from '@diagram-craft/canvas-app/tools/freehandTool';
import { PanTool } from '@diagram-craft/canvas-app/tools/panTool';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ActionDropdownMenuItem } from './react-app/components/ActionDropdownMenuItem';
import { ToggleActionDropdownMenuItem } from './react-app/components/ToggleActionDropdownMenuItem';
import { FileDialog } from './react-app/FileDialog';
import { urlToName } from '@diagram-craft/utils/url';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ApplicationTriggers, ContextMenuTarget } from '@diagram-craft/canvas/ApplicationTriggers';
import { ActionToolbarButton } from './react-app/toolbar/ActionToolbarButton';
import { ImageInsertDialog } from './react-app/ImageInsertDialog';
import { TableInsertDialog } from './react-app/TableInsertDialog';
import { RectTool } from '@diagram-craft/canvas-app/tools/rectTool';
import { ReferenceLayerDialog } from './react-app/components/NewReferenceLayerDialog';
import { StringInputDialog } from './react-app/components/StringInputDialog';

const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // eslint-disable-next-line
  if ((e as any)._triggered) return;
  fn();
  // eslint-disable-next-line
  (e as any)._triggered = true;
};

const tools: Record<ToolType, ToolContructor> = {
  move: MoveTool,
  text: TextTool,
  edge: EdgeTool,
  node: NodeTool,
  pen: PenTool,
  freehand: FreehandTool,
  pan: PanTool,
  rect: RectTool
};

const DarkModeToggleButton = () => {
  const redraw = useRedraw();
  const { actionMap } = useActions();
  useEventListener(actionMap['TOGGLE_DARK_MODE']!, 'actionchanged', redraw);
  return (
    <Toolbar.Button onClick={() => actionMap['TOGGLE_DARK_MODE']?.execute()}>
      {actionMap['TOGGLE_DARK_MODE']?.getState({}) ? (
        <TbSun size={'17.5px'} />
      ) : (
        <TbMoon size={'17.5px'} />
      )}
    </Toolbar.Button>
  );
};

export type DiagramRef = {
  name?: string;
  url: string;
};

type ActiveDocument = {
  doc: DiagramDocument;
  url?: string;
};

type ActiveDiagram = {
  diagram: Diagram;
  actionMap: Partial<ActionMap>;
};

const createActiveDiagram = ($d: Diagram, applicationState: ApplicationState): ActiveDiagram => {
  return {
    diagram: $d,
    actionMap: makeActionMap(defaultAppActions)({
      diagram: $d,
      applicationState: applicationState
    })
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface ApplicationTriggers {
      loadFromUrl?: (url: string) => void;
      newDocument?: () => void;
      clearDirty?: () => void;
    }
  }
}

export const App = (props: {
  url?: string;
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory<Diagram>;
}) => {
  const redraw = useRedraw();
  const applicationState = useRef(new ApplicationState());
  const userState = useRef(new UserState());

  const [activeDoc, setActiveDoc] = useState<ActiveDocument>({
    doc: props.doc,
    url: props.url
  });
  const [activeDiagram, setActiveDiagram] = useState<ActiveDiagram>(
    createActiveDiagram(activeDoc.doc.diagrams[0], applicationState.current)
  );

  const [dirty, setDirty] = useState(Autosave.exists());
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  const [messageDialogState, setMessageDialogState] = useState<MessageDialogState>(
    MessageDialog.INITIAL_STATE
  );
  const [dialogState, setDialogState] = useState<
    ApplicationTriggers.DialogState<keyof ApplicationTriggers.Dialogs> | undefined
  >(undefined);
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

  const $d = activeDiagram.diagram;
  const actionMap = activeDiagram.actionMap;
  const doc = activeDoc.doc;
  const url = activeDoc.url;

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

  const keyMap = defaultMacAppKeymap;

  const applicationTriggers: ApplicationTriggers = {
    pushHelp: (id: string, message: string) => {
      const help = applicationState.current.help;
      if (help && help.id === id && help.message === message) return;
      queueMicrotask(() => {
        applicationState.current.pushHelp({ id, message });
      });
    },
    popHelp: (id: string) => {
      applicationState.current.popHelp(id);
    },
    setHelp: (message: string) => {
      applicationState.current.setHelp({ id: 'default', message });
    },
    showContextMenu: <T extends keyof ApplicationTriggers.ContextMenus>(
      type: T,
      point: Point,
      mouseEvent: MouseEvent,
      args: ApplicationTriggers.ContextMenus[T]
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
    showDialog: <T extends keyof ApplicationTriggers.Dialogs>(
      dialogState: ApplicationTriggers.DialogState<T>
    ) => {
      setDialogState({
        ...dialogState,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onOk: (data: any) => {
          dialogState.onOk(data);
          setDialogState(undefined);
        },
        onCancel: () => {
          dialogState.onCancel();
          setDialogState(undefined);
        }
      });
    },
    showMessageDialog: (
      title: string,
      message: string,
      okLabel: string,
      cancelLabel: string,
      onClick: () => void
    ) => {
      setMessageDialogState({
        isOpen: true,
        title,
        message,
        buttons: [
          {
            label: okLabel,
            type: 'default',
            onClick: () => {
              onClick();
              setMessageDialogState(MessageDialog.INITIAL_STATE);
            }
          },
          {
            label: cancelLabel,
            type: 'cancel',
            onClick: () => {
              setMessageDialogState(MessageDialog.INITIAL_STATE);
            }
          }
        ]
      });
    },
    loadFromUrl: async (url: string) => {
      const doc = await loadFileFromUrl(url, props.documentFactory, props.diagramFactory);
      setActiveDoc({ doc, url });
      setActiveDiagram(createActiveDiagram(doc.diagrams[0], applicationState.current));
      Autosave.clear();
      setDirty(false);

      userState.current.addRecentFile(url);
    },
    newDocument: () => {
      // TODO: This is partially duplicated in AppLoader.ts
      const doc = props.documentFactory();
      const diagram = new Diagram(newid(), 'Untitled', doc);
      diagram.layers.add(
        new RegularLayer(newid(), 'Default', [], diagram),
        UnitOfWork.immediate(diagram)
      );
      doc.addDiagram(diagram);
      setActiveDoc({ doc, url: undefined });
      setActiveDiagram(createActiveDiagram(diagram, applicationState.current));
      Autosave.clear();
      setDirty(false);
    },
    clearDirty: () => {
      Autosave.clear();
      setDirty(false);
    }
  };

  return (
    <DiagramContext.Provider value={$d}>
      <ActionsContext.Provider
        value={{ actions: { actionMap, keyMap }, applicationTriggers: applicationTriggers }}
      >
        <ConfigurationContext.Provider
          value={{
            palette: {
              primary: defaultPalette
            },
            defaults: {
              node: nodeDefaults,
              edge: edgeDefaults
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
            open={dialogState?.name === 'fileOpen'}
            onOpen={dialogState?.onOk}
            onCancel={dialogState?.onCancel}
          />
          <ImageInsertDialog
            open={dialogState?.name === 'imageInsert'}
            onInsert={dialogState?.onOk}
            onCancel={dialogState?.onCancel}
            diagram={$d}
          />
          <TableInsertDialog
            open={dialogState?.name === 'tableInsert'}
            onInsert={dialogState?.onOk}
            onCancel={dialogState?.onCancel}
          />
          <ReferenceLayerDialog
            open={dialogState?.name === 'newReferenceLayer'}
            diagram={$d}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            onCreate={dialogState?.onOk as any}
            onCancel={dialogState?.onCancel}
          />
          <StringInputDialog
            open={dialogState?.name === 'stringInput'}
            {...dialogState?.props}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            onSave={dialogState?.onOk as any}
            onCancel={dialogState?.onCancel}
          />

          <div id="app" className={'dark-theme'}>
            <div id="menu">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className={'_menu-button'}>
                    <TbMenu2 size={'24px'} />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="cmp-context-menu" sideOffset={2} align={'start'}>
                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                        File
                        <div className="cmp-context-menu__right-slot">
                          <TbChevronRight />
                        </div>
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.SubContent
                          className="cmp-context-menu"
                          sideOffset={2}
                          alignOffset={-5}
                        >
                          <ActionDropdownMenuItem action={'FILE_NEW'}>New</ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'FILE_OPEN'}>
                            Open...
                          </ActionDropdownMenuItem>

                          <DropdownMenu.Sub>
                            <DropdownMenu.SubTrigger
                              className="cmp-context-menu__sub-trigger"
                              disabled={
                                userState.current.recentFiles.filter(url => url !== activeDoc.url)
                                  .length === 0
                              }
                            >
                              Open Recent...
                              <div className="cmp-context-menu__right-slot">
                                <TbChevronRight />
                              </div>
                            </DropdownMenu.SubTrigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.SubContent
                                className="cmp-context-menu"
                                sideOffset={2}
                                alignOffset={-5}
                              >
                                {userState.current.recentFiles
                                  .filter(url => url !== activeDoc.url)
                                  .map(url => (
                                    <DropdownMenu.Item
                                      key={url}
                                      className="cmp-context-menu__item"
                                      onSelect={() => applicationTriggers.loadFromUrl?.(url)}
                                    >
                                      {urlToName(url)}
                                    </DropdownMenu.Item>
                                  ))}
                              </DropdownMenu.SubContent>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Sub>
                          <ActionDropdownMenuItem action={'FILE_SAVE'}>Save</ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'FILE_SAVE'}>
                            Save As...
                          </ActionDropdownMenuItem>
                        </DropdownMenu.SubContent>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                        Edit
                        <div className="cmp-context-menu__right-slot">
                          <TbChevronRight />
                        </div>
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.SubContent
                          className="cmp-context-menu"
                          sideOffset={2}
                          alignOffset={-5}
                        >
                          <ActionDropdownMenuItem action={'UNDO'}>Undo</ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'REDO'}>Redo</ActionDropdownMenuItem>
                          <DropdownMenu.Separator className="cmp-context-menu__separator" />

                          <ActionDropdownMenuItem action={'CLIPBOARD_CUT'}>
                            Cut
                          </ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'CLIPBOARD_COPY'}>
                            Copy
                          </ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'DUPLICATE'}>
                            Duplicate
                          </ActionDropdownMenuItem>
                        </DropdownMenu.SubContent>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Sub>
                      <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
                        View
                        <div className="cmp-context-menu__right-slot">
                          <TbChevronRight />
                        </div>
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.SubContent
                          className="cmp-context-menu"
                          sideOffset={2}
                          alignOffset={-5}
                        >
                          <ActionDropdownMenuItem action={'ZOOM_IN'}>
                            Zoom In
                          </ActionDropdownMenuItem>
                          <ActionDropdownMenuItem action={'ZOOM_OUT'}>
                            Zoom Out
                          </ActionDropdownMenuItem>
                          <DropdownMenu.Separator className="cmp-context-menu__separator" />
                          <ToggleActionDropdownMenuItem action={'TOGGLE_RULER'}>
                            Ruler
                          </ToggleActionDropdownMenuItem>
                          <ToggleActionDropdownMenuItem action={'TOGGLE_HELP'}>
                            Help
                          </ToggleActionDropdownMenuItem>
                          <ToggleActionDropdownMenuItem action={'TOGGLE_DARK_MODE'}>
                            Dark Mode
                          </ToggleActionDropdownMenuItem>
                        </DropdownMenu.SubContent>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <div className={'_tools'}>
                <Toolbar.Root size={'large'}>
                  <ActionToggleButton action={'TOOL_MOVE'}>
                    <TbPointer size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_RECT'}>
                    <TbSquarePlus2 size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_EDGE'}>
                    <TbLine size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_TEXT'}>
                    <TbTextSize size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_FREEHAND'}>
                    <TbPencil size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_PEN'}>
                    <TbPolygon size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_NODE'}>
                    <TbLocation size={'17.5px'} transform={'scale(-1,1)'} />
                  </ActionToggleButton>
                  <Toolbar.Separator />
                  <ActionToolbarButton action={'IMAGE_INSERT'}>
                    <TbPhotoPlus size={'17.5px'} />
                  </ActionToolbarButton>
                  <ActionToolbarButton action={'TABLE_INSERT'}>
                    <TbTablePlus size={'17.5px'} />
                  </ActionToolbarButton>
                  <ActionToolbarButton action={'IMAGE_INSERT'}>
                    <TbPlus size={'17.5px'} />
                  </ActionToolbarButton>
                </Toolbar.Root>
              </div>

              <div className={'_document'}>
                {activeDoc.url ? urlToName(activeDoc.url) : 'Untitled'}

                <DirtyIndicator
                  dirty={dirty}
                  onDirtyChange={
                    url
                      ? async () => {
                          applicationTriggers.loadFromUrl?.(url);
                        }
                      : undefined
                  }
                />
              </div>

              <div className={'_extra-tools'}>
                <Toolbar.Root>
                  <ActionToggleButton action={'TOGGLE_HELP'}>
                    <TbHelpSquare size={'17.5px'} />
                  </ActionToggleButton>

                  <Toolbar.Button onClick={() => actionMap['ZOOM_OUT']?.execute()}>
                    <TbZoomOut size={'17.5px'} />
                  </Toolbar.Button>
                  <Toolbar.Button onClick={() => actionMap['ZOOM_IN']?.execute()}>
                    <TbZoomIn size={'17.5px'} />
                  </Toolbar.Button>

                  <DarkModeToggleButton />
                </Toolbar.Root>
              </div>
            </div>
            <div id="window-area">
              <div id="toolbar">
                <ContextSpecificToolbar />
              </div>

              <SideBar side={'left'}>
                <SideBarPage icon={TbPentagonPlus}>
                  <ErrorBoundary>
                    <PickerToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbStack}>
                  <ErrorBoundary>
                    <LayerToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbCheck}>
                  <ErrorBoundary>
                    <SelectToolWindow diagram={$d} />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbFile}>
                  <ErrorBoundary>
                    <DocumentToolWindow
                      document={doc}
                      value={$d.id}
                      onValueChange={v => {
                        setActiveDiagram(
                          createActiveDiagram(doc.getById(v)!, applicationState.current)
                        );
                      }}
                    />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbHistory}>
                  <ErrorBoundary>
                    <HistoryToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbSearch}>
                  <ErrorBoundary>
                    <QueryToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
              </SideBar>

              <SideBar side={'right'}>
                <SideBarPage icon={TbPalette}>
                  <ErrorBoundary>
                    <ObjectToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbInfoCircle}>
                  <ErrorBoundary>
                    <ObjectInfoToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbDatabaseEdit}>
                  <ErrorBoundary>
                    <ObjectDataToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
              </SideBar>

              <div id="canvas-area" className={'light-theme'}>
                <ErrorBoundary>
                  <ContextMenu.Root>
                    <ContextMenu.Trigger asChild={true}>
                      <EditableCanvas
                        ref={svgRef}
                        diagram={$d}
                        /* Note: this uid here to force redraw in case the diagram is reloaded */
                        key={$d.uid}
                        actionMap={actionMap}
                        tools={tools}
                        keyMap={keyMap}
                        applicationState={applicationState.current}
                        offset={
                          (userState.current.panelLeft ?? -1) >= 0
                            ? {
                                x: 250, // Corresponding to left panel width
                                y: 0
                              }
                            : Point.ORIGIN
                        }
                        className={'canvas'}
                        onDrop={canvasDropHandler($d)}
                        onDragOver={canvasDragOverHandler()}
                        applicationTriggers={applicationTriggers}
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
                              return (
                                <EdgeContextMenu target={state as ContextMenuTarget<'edge'>} />
                              );
                            }
                          }}
                        />
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                </ErrorBoundary>

                <Ruler orientation={'horizontal'} canvasRef={svgRef.current} />
                <Ruler orientation={'vertical'} canvasRef={svgRef.current} />

                <NodeTypePopup
                  {...popoverState}
                  onClose={() => setPopoverState(NodeTypePopup.INITIAL_STATE)}
                />

                <MessageDialog
                  {...messageDialogState}
                  onClose={() => setMessageDialogState(MessageDialog.INITIAL_STATE)}
                />
              </div>

              <div id="tabs">
                <DocumentTabs
                  value={$d.id}
                  onValueChange={v => {
                    setActiveDiagram(
                      createActiveDiagram(doc.getById(v)!, applicationState.current)
                    );
                  }}
                  document={doc}
                />

                <LayerIndicator />
              </div>
            </div>

            <HelpMessage applicationState={applicationState.current} actionMap={actionMap} />
          </div>
        </ConfigurationContext.Provider>
      </ActionsContext.Provider>
    </DiagramContext.Provider>
  );
};
