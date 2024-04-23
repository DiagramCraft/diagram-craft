import './App.css';
import { useEffect, useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test';
import { simpleDiagram } from './sample/simple';
import { LayerToolWindow } from './react-app/LayerToolWindow';
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
import { CanvasContextMenu } from './react-app/context-menu/CanvasContextMenu';
import { ContextMenuDispatcher } from './react-app/context-menu/ContextMenuDispatcher';
import { SelectionContextMenu } from './react-app/context-menu/SelectionContextMenu';
import { Toolbar } from './react-app/toolbar/Toolbar';
import { SideBar } from './react-app/SideBar';
import { SideBarPage } from './react-app/SideBarPage';
import { PickerToolWindow } from './react-app/PickerToolWindow';
import { ObjectToolWindow } from './react-app/ObjectProperties/ObjectToolWindow';
import { EdgeContextMenu } from './react-app/context-menu/EdgeContextMenu';
import { useEventListener } from './react-app/hooks/useEventListener';
import { useRedraw } from './react-app/useRedraw';
import { defaultAppActions, defaultMacAppKeymap } from './react-app/appActionMap';
import { ObjectInfo } from './react-app/ObjectInfo/ObjectInfo';
import { DocumentTabs } from './react-app/DocumentTabs';
import { HistoryToolWindow } from './react-app/HistoryToolWindow';
import { Ruler } from './react-app/Ruler';
import { ActionsContext, useActions } from './react-app/context/ActionsContext';
import { DiagramContext } from './react-app/context/DiagramContext';
import { ConfigurationContext } from './react-app/context/ConfigurationContext';
import { defaultPalette } from './react-app/ObjectProperties/palette';
import { DocumentToolWindow } from './react-app/DocumentToolWindow';
import { ActionToggleButton } from './react-app/toolbar/ActionToggleButton';
import { LayerIndicator } from './react-app/LayerIndicator';
import { testDiagram } from './sample/test';
import { NodeTypePopup, NodeTypePopupState } from './react-app/NodeTypePopup';
import { MessageDialog, MessageDialogState } from './react-app/components/MessageDialog';
import { ObjectData } from './react-app/ObjectData/ObjectData';
import { QueryToolWindow } from './react-app/QueryToolWindow';
import { canvasDragOverHandler, canvasDropHandler } from './react-app/PickerToolWindow.handlers';
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
import { SerializedDiagram } from '@diagram-craft/model/serialization/types';
import { Diagram } from '@diagram-craft/model/diagram';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { edgeDefaults, nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { debounce } from '@diagram-craft/utils/debounce';
import { Autosave } from './Autosave';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DrawioShapeNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/DrawioShape.nodeType';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { HelpMessage } from './react-app/components/HelpMessage';

const oncePerEvent = (e: MouseEvent, fn: () => void) => {
  // eslint-disable-next-line
  if ((e as any)._triggered) return;
  fn();
  // eslint-disable-next-line
  (e as any)._triggered = true;
};

export const diagramFactory = (d: SerializedDiagram, doc: DiagramDocument) => {
  return new Diagram(d.id, d.name, doc);
};

export const documentFactory = () => {
  return new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());
};

const diagrams = [
  {
    name: 'Snap test',
    document: deserializeDiagramDocument(snapTestDiagram, documentFactory, diagramFactory)
  },
  {
    name: 'Test',
    document: deserializeDiagramDocument(testDiagram, documentFactory, diagramFactory)
  },
  {
    name: 'Simple',
    document: deserializeDiagramDocument(simpleDiagram, documentFactory, diagramFactory)
  }
];

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

const defaultDiagram = 2;

const Document = (props: { doc: DiagramDocument }) => {
  const [doc, setDoc] = useState<DiagramDocument>(props.doc);
  const [$d, setDiagram] = useState(doc.diagrams[0]);
  const [popoverState, setPopoverState] = useState<NodeTypePopupState>(NodeTypePopup.INITIAL_STATE);
  const [dialogState, setDialogState] = useState<MessageDialogState>(MessageDialog.INITIAL_STATE);
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);
  const applicationState = useRef(new ApplicationState());
  const userState = useRef(new UserState());

  const [actionMap] = useState(() => {
    return makeActionMap(defaultAppActions)({
      diagram: $d,
      applicationState: applicationState.current,
      userState: userState.current
    });
  });

  const svgRef = useRef<SVGSVGElement>(null);

  const autosave = debounce(() => Autosave.save(doc), 1000);

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
                  onChange={async d => {
                    const doc = await d;
                    setDoc(doc);
                    setDiagram(doc.diagrams[0]);
                    Autosave.clear();
                  }}
                />
              </div>

              <div className={'_extra-tools'}>
                <div className={'cmp-toolbar'}>
                  <ReactToolbar.Root>
                    <ActionToggleButton action={'TOGGLE_HELP'}>
                      <TbHelpSquare size={'1.1rem'} />
                    </ActionToggleButton>
                  </ReactToolbar.Root>

                  <button
                    className={'cmp-toolbar__button'}
                    onClick={() => actionMap['ZOOM_IN']?.execute()}
                  >
                    <TbZoomOut size={'1.1rem'} />
                  </button>
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
                <SideBarPage icon={TbDropletSearch}>
                  <QueryToolWindow />
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
                <ContextMenu.Root>
                  <ContextMenu.Trigger asChild={true}>
                    <EditableCanvas
                      ref={svgRef}
                      diagram={$d}
                      key={$d.id}
                      actionMap={actionMap}
                      tools={tools}
                      keyMap={keyMap}
                      applicationState={applicationState.current}
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
                    setDiagram(doc.getById(v)!);
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

const App = () => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [stencils, setStencils] = useState<undefined | Array<Stencil>>();
  const redraw = useRedraw();

  // TODO: Not working:
  //   [x] citrix
  //   [ ] floorplan
  //   [x] flowchart
  //   [ ] fluid_power

  useEffect(() => {
    fetch('/stencils/flowchart.xml')
      .then(res => res.text())
      .then(r => {
        const parser = new DOMParser();
        const $doc = parser.parseFromString(r, 'application/xml');

        const newStencils: Array<Stencil> = [];

        const $shapes = $doc.getElementsByTagName('shape');
        for (let i = 0; i < $shapes.length; i++) {
          const name = $shapes[i].getAttribute('name')!;
          newStencils.push({
            node: new DrawioShapeNodeDefinition(),
            group: 'Stencils',
            key: name,
            props: {
              fill: { color: '#0072de' },
              stroke: { color: '#ffffff' },
              drawio: { shape: btoa(new XMLSerializer().serializeToString($shapes[i])) }
            }
          });
        }

        setStencils(newStencils);
      });
  }, []);

  useEffect(() => {
    Promise.all([
      Autosave.load(documentFactory, diagramFactory),
      diagrams[defaultDiagram].document
    ]).then(([autosaved, defDiagram]) => {
      setDoc(autosaved ?? defDiagram);
    });
  }, []);

  useEffect(() => {
    if (stencils && doc) {
      stencils.forEach(stencil => {
        doc.nodeDefinitions.register(stencil.node, stencil);
      });
      redraw();
    }
  }, [doc, stencils]);

  if (doc && stencils) return <Document doc={doc} />;
  else return null;
};

export default App;
