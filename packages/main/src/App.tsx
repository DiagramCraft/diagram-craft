import './App.css';
import { useRef, useState } from 'react';
import { LayerToolWindow } from './react-app/toolwindow/LayerToolWindow/LayerToolWindow';
import { DocumentSelector } from './react-app/DocumentSelector';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import {
  TbCategoryPlus,
  TbDatabaseEdit,
  TbDropletSearch,
  TbFiles,
  TbHelpSquare,
  TbHistory,
  TbInfoCircle,
  TbLayoutGridAdd,
  TbLine,
  TbLocation,
  TbMenu2,
  TbMoon,
  TbPalette,
  TbPencil,
  TbPointer,
  TbPolygon,
  TbSelectAll,
  TbStack2,
  TbSun,
  TbTextSize,
  TbZoomIn,
  TbZoomOut
} from 'react-icons/tb';
import { CanvasContextMenu } from './react-app/context-menu-dispatcher/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu-dispatcher/ContextMenuDispatcher';
import { SelectionContextMenu } from './react-app/context-menu-dispatcher/SelectionContextMenu';
import { Toolbar } from './react-app/toolbar/Toolbar';
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
import { debounce } from '@diagram-craft/utils/debounce';
import { Autosave } from './Autosave';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { HelpMessage } from './react-app/components/HelpMessage';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DirtyIndicator } from './react-app/DirtyIndicator';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { ErrorBoundary } from './react-app/ErrorBoundary';

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
  pen: PenTool
};

const DarkModeToggleButton = () => {
  const redraw = useRedraw();
  const { actionMap } = useActions();
  useEventListener(actionMap['TOGGLE_DARK_MODE']!, 'actionchanged', redraw);
  return (
    <button
      className={'cmp-toolbar__button'}
      onClick={() => actionMap['TOGGLE_DARK_MODE']?.execute()}
    >
      {actionMap['TOGGLE_DARK_MODE']?.getState({}) ? (
        <TbSun size={'17.5px'} />
      ) : (
        <TbMoon size={'17.5px'} />
      )}
    </button>
  );
};

export type ContextMenuTarget = { pos: Point } & (
  | { type: 'canvas' }
  | { type: 'edge'; id: string }
  | { type: 'selection' }
);

export type DiagramRef = {
  name?: string;
  url: string;
};

type ActiveDocument = {
  doc: DiagramDocument;
  url: string;
};

type ActiveDiagram = {
  diagram: Diagram;
  actionMap: Partial<ActionMap>;
};

const createActiveDiagram = (
  $d: Diagram,
  applicationState: ApplicationState,
  userState: UserState
): ActiveDiagram => {
  return {
    diagram: $d,
    actionMap: makeActionMap(defaultAppActions)({
      diagram: $d,
      applicationState: applicationState,
      userState: userState
    })
  };
};

export const App = (props: {
  url: string;
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory<Diagram>;
  recent: Array<DiagramRef>;
}) => {
  const applicationState = useRef(new ApplicationState());
  const userState = useRef(new UserState());

  const [activeDoc, setActiveDoc] = useState<ActiveDocument>({
    doc: props.doc,
    url: props.url
  });
  const [activeDiagram, setActiveDiagram] = useState<ActiveDiagram>(
    createActiveDiagram(activeDoc.doc.diagrams[0], applicationState.current, userState.current)
  );

  const [dirty, setDirty] = useState(Autosave.exists());
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  const [dialogState, setDialogState] = useState<MessageDialogState>(MessageDialog.INITIAL_STATE);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const $d = activeDiagram.diagram;
  const actionMap = activeDiagram.actionMap;
  const doc = activeDoc.doc;
  const url = activeDoc.url;

  const autosave = debounce(() => {
    Autosave.save(url, doc);
    setDirty(true);
  }, 1000);

  useEventListener($d, 'change', autosave);
  useEventListener($d, 'elementAdd', autosave);
  useEventListener($d, 'elementChange', autosave);
  useEventListener($d, 'elementRemove', autosave);
  useEventListener(doc, 'diagramremoved', autosave);
  useEventListener(doc, 'diagramadded', autosave);
  useEventListener(doc, 'diagramchanged', autosave);

  const keyMap = defaultMacAppKeymap;
  return (
    <DiagramContext.Provider value={$d}>
      <ActionsContext.Provider value={{ actionMap, keyMap }}>
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
          <div id="app" className={'dark-theme'}>
            <div id="menu">
              <div className={'_menu-button'}>
                <div>
                  <TbMenu2 size={'24px'} />
                </div>
              </div>

              <div className={'_tools'}>
                <ReactToolbar.Root className="cmp-toolbar" data-size={'large'}>
                  <ActionToggleButton action={'TOOL_MOVE'}>
                    <TbPointer size={'17.5px'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbLayoutGridAdd size={'17.5px'} />
                  </button>
                  <ActionToggleButton action={'TOOL_EDGE'}>
                    <TbLine size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_TEXT'}>
                    <TbTextSize size={'17.5px'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbPencil size={'17.5px'} />
                  </button>
                  <ActionToggleButton action={'TOOL_PEN'}>
                    <TbPolygon size={'17.5px'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_NODE'}>
                    <TbLocation size={'17.5px'} transform={'scale(-1,1)'} />
                  </ActionToggleButton>
                </ReactToolbar.Root>
              </div>

              <div className={'_document'}>
                <DocumentSelector
                  diagrams={props.recent}
                  documentFactory={props.documentFactory}
                  diagramFactory={props.diagramFactory}
                  selectedUrl={url}
                  onChange={async url => {
                    const doc = await loadFileFromUrl(
                      url,
                      props.documentFactory,
                      props.diagramFactory
                    );
                    setActiveDoc({ doc, url });
                    setActiveDiagram(
                      createActiveDiagram(
                        doc.diagrams[0],
                        applicationState.current,
                        userState.current
                      )
                    );
                    Autosave.clear();
                    setDirty(false);
                  }}
                />

                <DirtyIndicator
                  dirty={dirty}
                  onDirtyChange={async () => {
                    const newDoc = await loadFileFromUrl(
                      url,
                      props.documentFactory,
                      props.diagramFactory
                    );
                    setActiveDoc({ doc: newDoc, url: url });
                    setActiveDiagram(
                      createActiveDiagram(
                        newDoc.diagrams[0],
                        applicationState.current,
                        userState.current
                      )
                    );
                    Autosave.clear();
                    setDirty(false);
                  }}
                />
              </div>

              <div className={'_extra-tools'}>
                <div className={'cmp-toolbar'}>
                  <ReactToolbar.Root>
                    <ActionToggleButton action={'TOGGLE_HELP'}>
                      <TbHelpSquare size={'17.5px'} />
                    </ActionToggleButton>
                  </ReactToolbar.Root>

                  <button
                    className={'cmp-toolbar__button'}
                    onClick={() => actionMap['ZOOM_OUT']?.execute()}
                  >
                    <TbZoomOut size={'17.5px'} />
                  </button>
                  <button
                    className={'cmp-toolbar__button'}
                    onClick={() => actionMap['ZOOM_IN']?.execute()}
                  >
                    <TbZoomIn size={'17.5px'} />
                  </button>

                  <DarkModeToggleButton />
                </div>
              </div>
            </div>
            <div id="window-area">
              <div id="toolbar">
                <Toolbar />
              </div>

              <SideBar side={'left'} userState={userState.current}>
                <SideBarPage icon={TbCategoryPlus}>
                  <ErrorBoundary>
                    <PickerToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbStack2}>
                  <ErrorBoundary>
                    <LayerToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
                <SideBarPage icon={TbSelectAll}>TbSelectAll</SideBarPage>
                <SideBarPage icon={TbFiles}>
                  <ErrorBoundary>
                    <DocumentToolWindow
                      document={doc}
                      value={$d.id}
                      onValueChange={v => {
                        setActiveDiagram(
                          createActiveDiagram(
                            doc.getById(v)!,
                            applicationState.current,
                            userState.current
                          )
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
                <SideBarPage icon={TbDropletSearch}>
                  <ErrorBoundary>
                    <QueryToolWindow />
                  </ErrorBoundary>
                </SideBarPage>
              </SideBar>

              <SideBar side={'right'} userState={userState.current}>
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
                        applicationTriggers={{
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
                          showCanvasContextMenu: (point: Point, mouseEvent: MouseEvent) => {
                            oncePerEvent(mouseEvent, () => {
                              contextMenuTarget.current = { type: 'canvas', pos: point };
                            });
                          },
                          showEdgeContextMenu: (
                            point: Point,
                            id: string,
                            mouseEvent: MouseEvent
                          ) => {
                            oncePerEvent(mouseEvent, () => {
                              contextMenuTarget.current = { type: 'edge', id, pos: point };
                            });
                          },
                          showNodeContextMenu: (
                            _point: Point,
                            _id: string,
                            _mouseEvent: MouseEvent
                          ) => {
                            // TODO: To be implemented
                            //contextMenuTarget.current = { type: 'node', id, pos: point };
                          },
                          showSelectionContextMenu: (point: Point, mouseEvent: MouseEvent) => {
                            oncePerEvent(mouseEvent, () => {
                              contextMenuTarget.current = { type: 'selection', pos: point };
                            });
                          },
                          showNodeLinkPopup: (
                            point: Point,
                            sourceNodeId: string,
                            edgId: string
                          ) => {
                            const screenPoint = $d.viewBox.toScreenPoint(point);
                            setPopoverState({
                              isOpen: true,
                              position: screenPoint,
                              nodeId: sourceNodeId,
                              edgeId: edgId
                            });
                          },
                          showDialog: (
                            title: string,
                            message: string,
                            okLabel: string,
                            cancelLabel: string,
                            onClick: () => void
                          ) => {
                            setDialogState({
                              isOpen: true,
                              title,
                              message,
                              buttons: [
                                {
                                  label: okLabel,
                                  type: 'default',
                                  onClick: () => {
                                    onClick();
                                    setDialogState(MessageDialog.INITIAL_STATE);
                                  }
                                },
                                {
                                  label: cancelLabel,
                                  type: 'cancel',
                                  onClick: () => {
                                    setDialogState(MessageDialog.INITIAL_STATE);
                                  }
                                }
                              ]
                            });
                          }
                        }}
                      />
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className="cmp-context-menu">
                        <ContextMenuDispatcher
                          state={contextMenuTarget}
                          createContextMenu={state => {
                            if (state.type === 'canvas') {
                              return <CanvasContextMenu target={state} />;
                            } else if (state.type === 'selection') {
                              return <SelectionContextMenu />;
                            } else {
                              return <EdgeContextMenu target={state} />;
                            }
                          }}
                        />
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                </ErrorBoundary>

                <Ruler orientation={'horizontal'} canvasRef={svgRef} />
                <Ruler orientation={'vertical'} canvasRef={svgRef} />

                <NodeTypePopup
                  {...popoverState}
                  onClose={() => setPopoverState(NodeTypePopup.INITIAL_STATE)}
                />

                <MessageDialog
                  {...dialogState}
                  onClose={() => setDialogState(MessageDialog.INITIAL_STATE)}
                />
              </div>

              <div id="tabs">
                <DocumentTabs
                  value={$d.id}
                  onValueChange={v => {
                    setActiveDiagram(
                      createActiveDiagram(
                        doc.getById(v)!,
                        applicationState.current,
                        userState.current
                      )
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
