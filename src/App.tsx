import './App.css';
import { EditableCanvas } from './react-canvas-editor/EditableCanvas.tsx';
import { useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { LayerToolWindow } from './react-app/LayerToolWindow.tsx';
import { DocumentSelector } from './react-app/DocumentSelector.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import {
  TbCategoryPlus,
  TbDatabaseEdit,
  TbFiles,
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
import { CanvasContextMenu } from './react-app/context-menu/CanvasContextMenu.tsx';
import { ContextMenuDispatcher } from './react-app/context-menu/ContextMenuDispatcher.tsx';
import { SelectionContextMenu } from './react-app/context-menu/SelectionContextMenu.tsx';
import { Toolbar } from './react-app/toolbar/Toolbar.tsx';
import { defaultEdgeRegistry, defaultNodeRegistry } from './react-canvas-viewer/defaultRegistry.ts';
import { SideBar } from './react-app/SideBar.tsx';
import { SideBarPage } from './react-app/SideBarPage.tsx';
import {
  canvasDragOverHandler,
  canvasDropHandler,
  PickerToolWindow
} from './react-app/PickerToolWindow.tsx';
import { ObjectToolWindow } from './react-app/ObjectProperties/ObjectToolWindow.tsx';
import { EdgeContextMenu } from './react-app/context-menu/EdgeContextMenu.tsx';
import { useEventListener } from './react-app/hooks/useEventListener.ts';
import { useRedraw } from './react-canvas-viewer/useRedraw.tsx';
import { defaultAppActions } from './react-app/appActionMap.ts';
import { defaultMacKeymap, makeActionMap } from './base-ui/keyMap.ts';
import { ObjectInfo } from './react-app/ObjectInfo/ObjectInfo.tsx';
import { DocumentTabs } from './react-app/DocumentTabs.tsx';
import { UserState } from './base-ui/UserState.ts';
import { HistoryToolWindow } from './react-app/HistoryToolWindow.tsx';
import { Ruler } from './react-app/Ruler.tsx';
import { ActionsContext, useActions } from './react-app/context/ActionsContext.tsx';
import { DiagramContext } from './react-app/context/DiagramContext.tsx';
import { ConfigurationContext } from './react-app/context/ConfigurationContext.tsx';
import { defaultPalette } from './react-app/ObjectProperties/palette.ts';
import { edgeDefaults, nodeDefaults } from './model/diagramDefaults.ts';
import { DocumentToolWindow } from './react-app/DocumentToolWindow.tsx';
import { Diagram } from './model/diagram.ts';
import { ApplicationState } from './base-ui/ApplicationState.ts';
import { ActionToggleButton } from './react-app/toolbar/ActionToggleButton.tsx';
import { LayerIndicator } from './react-app/LayerIndicator.tsx';
import { testDiagram } from './sample/test.ts';
import { SerializedDiagram } from './model/serialization/types.ts';
import { deserializeDiagramDocument } from './model/serialization/deserialize.ts';
import { Point } from './geometry/point.ts';
import { NodeTypePopup, NodeTypePopupState } from './react-app/NodeTypePopup.tsx';
import { SimpleDialog, SimpleDialogState } from './react-app/components/SimpleDialog.tsx';
import { ObjectData } from './react-app/ObjectData/ObjectData.tsx';

const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // eslint-disable-next-line
  if ((e as any)._triggered) return;
  fn();
  // eslint-disable-next-line
  (e as any)._triggered = true;
};

const factory = (d: SerializedDiagram) => {
  return new Diagram(d.id, d.name, defaultNodeRegistry(), defaultEdgeRegistry());
};

const diagrams = [
  {
    name: 'Snap test',
    document: deserializeDiagramDocument(snapTestDiagram, factory)
  },
  {
    name: 'Test',
    document: deserializeDiagramDocument(testDiagram, factory)
  },
  {
    name: 'Simple',
    document: deserializeDiagramDocument(simpleDiagram, factory)
  }
];

const DarkModeToggleButton = () => {
  const redraw = useRedraw();
  const { actionMap } = useActions();
  useEventListener(actionMap['TOGGLE_DARK_MODE']!, 'actionchanged', redraw);
  return (
    <button
      className={'cmp-toolbar__button'}
      onClick={() => actionMap['TOGGLE_DARK_MODE']?.execute()}
    >
      {actionMap['TOGGLE_DARK_MODE']?.state ? (
        <TbSun size={'1.1rem'} />
      ) : (
        <TbMoon size={'1.1rem'} />
      )}
    </button>
  );
};

export type ContextMenuTarget = { pos: Point } & (
  | { type: 'canvas' }
  | { type: 'edge'; id: string }
  | { type: 'selection' }
);

const App = () => {
  const defaultDiagram = 2;
  const [doc, setDoc] = useState(diagrams[defaultDiagram].document);
  const [$d, setDiagram] = useState(diagrams[defaultDiagram].document.diagrams[0]);
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  const [dialogState, setDialogState] = useState<SimpleDialogState>(SimpleDialog.INITIAL_STATE);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);
  const applicationState = useRef(new ApplicationState());
  const userState = useRef(new UserState());

  const svgRef = useRef<SVGSVGElement>(null);

  const actionMap = makeActionMap(defaultAppActions)({
    diagram: $d,
    applicationState: applicationState.current,
    userState: userState.current
  });

  const keyMap = defaultMacKeymap;
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
              Times: 'Times',
              Arial: 'Arial',
              'Sans Serif': 'sans-serif',
              Helvetica: 'Helvetica',
              Verdana: 'Verdana',
              Courier: 'Courier',
              'Comic Sans': 'Comic Sans MS',
              Impact: 'Impact',
              Tahoma: 'Tahoma',
              Trebuchet: 'Trebuchet MS',
              Georgia: 'Georgia'
            }
          }}
        >
          <div id="app" className={'dark-theme'}>
            <div id="menu">
              <div className={'_menu-button'}>
                <div>
                  <TbMenu2 size={'1.5rem'} />
                </div>
              </div>

              <div className={'_tools'}>
                <ReactToolbar.Root className="cmp-toolbar" data-size={'large'}>
                  <ActionToggleButton action={'TOOL_MOVE'}>
                    <TbPointer size={'1.1rem'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbLayoutGridAdd size={'1.1rem'} />
                  </button>
                  <ActionToggleButton action={'TOOL_EDGE'}>
                    <TbLine size={'1.1rem'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_TEXT'}>
                    <TbTextSize size={'1.1rem'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbPencil size={'1.1rem'} />
                  </button>
                  <ActionToggleButton action={'TOOL_PEN'}>
                    <TbPolygon size={'1.1rem'} />
                  </ActionToggleButton>
                  <ActionToggleButton action={'TOOL_NODE'}>
                    <TbLocation size={'1.1rem'} transform={'scale(-1,1)'} />
                  </ActionToggleButton>
                </ReactToolbar.Root>
              </div>

              <div className={'_document'}>
                <DocumentSelector
                  diagrams={diagrams}
                  defaultValue={defaultDiagram}
                  onChange={d => {
                    setDoc(d);
                    setDiagram(d.diagrams[0]);
                  }}
                />
              </div>

              <div className={'_extra-tools'}>
                <div className={'cmp-toolbar'}>
                  <button
                    className={'cmp-toolbar__button'}
                    onClick={() => actionMap['ZOOM_IN']?.execute()}
                  >
                    <TbZoomOut size={'1.1rem'} />
                  </button>
                  <button
                    className={'cmp-toolbar__button'}
                    onClick={() => actionMap['ZOOM_OUT']?.execute()}
                  >
                    <TbZoomIn size={'1.1rem'} />
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
                  <PickerToolWindow />
                </SideBarPage>
                <SideBarPage icon={TbStack2}>
                  <LayerToolWindow />
                </SideBarPage>
                <SideBarPage icon={TbSelectAll}>TbSelectAll</SideBarPage>
                <SideBarPage icon={TbFiles}>
                  <DocumentToolWindow
                    document={doc}
                    value={$d.id}
                    onValueChange={v => {
                      setDiagram(doc.getById(v)!);
                    }}
                  />
                </SideBarPage>
                <SideBarPage icon={TbHistory}>
                  <HistoryToolWindow />
                </SideBarPage>
              </SideBar>

              <SideBar side={'right'} userState={userState.current}>
                <SideBarPage icon={TbPalette}>
                  <ObjectToolWindow />
                </SideBarPage>
                <SideBarPage icon={TbInfoCircle}>
                  <ObjectInfo />
                </SideBarPage>
                <SideBarPage icon={TbDatabaseEdit}>
                  <ObjectData />
                </SideBarPage>
              </SideBar>

              <div id="canvas-area" className={'light-theme'}>
                <Ruler orientation={'horizontal'} canvasRef={svgRef} />
                <Ruler orientation={'vertical'} canvasRef={svgRef} />

                <ContextMenu.Root>
                  <ContextMenu.Trigger asChild={true}>
                    <EditableCanvas
                      ref={svgRef}
                      key={$d.id}
                      applicationState={applicationState.current}
                      className={'canvas'}
                      onDrop={canvasDropHandler($d)}
                      onDragOver={canvasDragOverHandler()}
                      applicationTriggers={{
                        showCanvasContextMenu: (point: Point, mouseEvent: MouseEvent) => {
                          oncePerEvent(mouseEvent, () => {
                            contextMenuTarget.current = { type: 'canvas', pos: point };
                          });
                        },
                        showEdgeContextMenu: (point: Point, id: string, mouseEvent: MouseEvent) => {
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
                        showNodeLinkPopup: (point: Point, sourceNodeId: string, edgId: string) => {
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
                                  setDialogState(SimpleDialog.INITIAL_STATE);
                                }
                              },
                              {
                                label: cancelLabel,
                                type: 'cancel',
                                onClick: () => {
                                  setDialogState(SimpleDialog.INITIAL_STATE);
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

                <NodeTypePopup
                  {...popoverState}
                  onClose={() => setPopoverState(NodeTypePopup.INITIAL_STATE)}
                />

                <SimpleDialog
                  {...dialogState}
                  onClose={() => setDialogState(SimpleDialog.INITIAL_STATE)}
                />
              </div>

              <div id="tabs">
                <DocumentTabs
                  value={$d.id}
                  onValueChange={v => {
                    setDiagram(doc.getById(v)!);
                  }}
                  document={doc}
                />

                <LayerIndicator />
              </div>
            </div>
          </div>
        </ConfigurationContext.Provider>
      </ActionsContext.Provider>
    </DiagramContext.Provider>
  );
};

export default App;
