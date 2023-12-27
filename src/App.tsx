import './App.css';
import { deserializeDiagramDocument, SerializedDiagram } from './model/serialization.ts';
import { ContextMenuEvent, EditableCanvas } from './react-canvas-editor/EditableCanvas.tsx';
import React, { useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { LayerToolWindow } from './react-app/LayerToolWindow.tsx';
import { DocumentSelector } from './react-app/DocumentSelector.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import {
  TbCategoryPlus,
  TbClick,
  TbDatabaseEdit,
  TbFiles,
  TbHistory,
  TbInfoCircle,
  TbLayoutGridAdd,
  TbLine,
  TbMenu2,
  TbMoon,
  TbPalette,
  TbPencil,
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
import { DiagramElement } from './model/diagramNode.ts';
import { DocumentTabs } from './react-app/components/DocumentTabs.tsx';
import { UserState } from './base-ui/UserState.ts';
import { HistoryToolWindow } from './react-app/HistoryToolWindow.tsx';
import { Ruler } from './react-app/Ruler.tsx';
import { ActionsContext, useActions } from './react-app/context/ActionsContext.tsx';
import { DiagramContext } from './react-app/context/DiagramContext.tsx';
import { ConfigurationContext } from './react-app/context/ConfigurationContext.tsx';
import { additionalHues, primaryColors } from './react-app/ObjectProperties/palette.ts';
import { edgeDefaults, nodeDefaults } from './model/diagramDefaults.ts';
import { DocumentToolWindow } from './react-app/DocumentToolWindow.tsx';
import { Diagram } from './model/diagram.ts';
import { ApplicationState } from './base-ui/ApplicationState.ts';
import { ActionToggleButton } from './react-app/toolbar/ActionToggleButton.tsx';
import { LayerIndicator } from './react-app/components/LayerIndicator.tsx';

const factory = (d: SerializedDiagram, elements?: DiagramElement[]) => {
  return new Diagram(d.id, d.name, defaultNodeRegistry(), defaultEdgeRegistry(), elements);
};

const diagrams = [
  {
    name: 'Snap test',
    document: deserializeDiagramDocument(snapTestDiagram, factory)
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

const App = () => {
  const defaultDiagram = 1;
  const [doc, setDoc] = useState(diagrams[defaultDiagram].document);
  const [$d, setDiagram] = useState(diagrams[defaultDiagram].document.diagrams[0]);
  const contextMenuTarget = useRef<
    (ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>) | null
  >(null);
  const applicationState = useRef(new ApplicationState());
  const userState = useRef(new UserState());

  const svgRef = useRef<SVGSVGElement>(null);
  /*
useEffect(() => {
  perftest(new BezierPerformanceTest());
}, []);
*/
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
              primary: primaryColors,
              secondary: additionalHues
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
                    <TbClick size={'1.1rem'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbLayoutGridAdd size={'1.1rem'} />
                  </button>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbLine size={'1.1rem'} />
                  </button>
                  <ActionToggleButton action={'TOOL_TEXT'}>
                    <TbTextSize size={'1.1rem'} />
                  </ActionToggleButton>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbPencil size={'1.1rem'} />
                  </button>
                  <button className={'cmp-toolbar__toggle-item'}>
                    <TbPolygon size={'1.1rem'} />
                  </button>
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
                <SideBarPage icon={TbDatabaseEdit}>TbDatabaseEdit</SideBarPage>
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
                      onContextMenu={e => {
                        contextMenuTarget.current = e;
                      }}
                      onDrop={canvasDropHandler($d)}
                      onDragOver={canvasDragOverHandler()}
                      onResetTool={() => (applicationState.current.tool = 'move')}
                    />
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content className="cmp-context-menu">
                      <ContextMenuDispatcher
                        state={contextMenuTarget}
                        createContextMenu={state => {
                          if (state.contextMenuTarget.type === 'canvas') {
                            return <CanvasContextMenu target={state.contextMenuTarget} />;
                          } else if (state.contextMenuTarget.type === 'selection') {
                            return <SelectionContextMenu />;
                          } else {
                            return <EdgeContextMenu target={state.contextMenuTarget} />;
                          }
                        }}
                      />
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
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
