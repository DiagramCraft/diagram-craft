import './App.css';
import { deserializeDiagram } from './model-viewer/serialization.ts';
import { ContextMenuEvent, EditableCanvas } from './react-canvas-editor/EditableCanvas.tsx';
import React, { useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { EditableDiagram } from './model-editor/editable-diagram.ts';
import { InfoToolWindow } from './react-app/InfoToolWindow.tsx';
import { LayerToolWindow } from './react-app/LayerToolWindow.tsx';
import { DocumentSelector } from './react-app/DocumentSelector.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
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
  TbPalette,
  TbPencil,
  TbPolygon,
  TbSelectAll,
  TbStack2,
  TbTextSize,
  TbZoomIn,
  TbZoomOut
} from 'react-icons/tb';
import { CanvasContextMenu } from './react-app/context-menu/CanvasContextMenu.tsx';
import { ContextMenuDispatcher } from './react-app/context-menu/ContextMenuDispatcher.tsx';
import { SelectionContextMenu } from './react-app/context-menu/SelectionContextMenu.tsx';
import { defaultCanvasActions, defaultMacKeymap, makeActionMap } from './base-ui/keyMap.ts';
import { Toolbar } from './react-app/toolbar/Toolbar.tsx';
import { DragDropManager } from './react-canvas-viewer/DragDropManager.tsx';
import { defaultEdgeRegistry, defaultNodeRegistry } from './react-canvas-viewer/defaultRegistry.ts';
import { SideBar } from './react-app/SideBar.tsx';
import { SideBarPage } from './react-app/SideBarPage.tsx';
import {
  canvasDragOverHandler,
  canvasDropHandler,
  PickerToolWindow
} from './react-app/PickerToolWindow.tsx';
import { ObjectProperties } from './react-app/ObjectProperties/ObjectProperties.tsx';
import { EdgeContextMenu } from './react-app/context-menu/EdgeContextMenu.tsx';

const diagrams = [
  {
    name: 'Snap test',
    diagram: new EditableDiagram(
      'snapTest',
      deserializeDiagram(snapTestDiagram),
      defaultNodeRegistry(),
      defaultEdgeRegistry()
    )
  },
  {
    name: 'Simple',
    diagram: new EditableDiagram(
      'simple',
      deserializeDiagram(simpleDiagram),
      defaultNodeRegistry(),
      defaultEdgeRegistry()
    )
  }
];

const App = () => {
  const defaultDiagram = 1;
  const [$d, setDiagram] = useState(diagrams[defaultDiagram].diagram);
  const contextMenuTarget = useRef<
    (ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>) | null
  >(null);
  /*
  useEffect(() => {
    perftest(new BezierPerformanceTest());
  }, []);
*/
  const actionMap = makeActionMap(defaultCanvasActions)({ diagram: $d });
  const keyMap = defaultMacKeymap;
  return (
    <div>
      <DragDropManager>
        <div id="app" className={'dark-theme'}>
          <div id="menu">
            <div className={'_menu-button'}>
              <div>
                <TbMenu2 size={'1.5rem'} />
              </div>
            </div>

            <div className={'_tools'}>
              <div className={'cmp-toolbar'} data-size={'large'}>
                <button className={'cmp-toolbar__toggle-item'} data-state={'on'}>
                  <TbClick size={'1.1rem'} />
                </button>
                <button className={'cmp-toolbar__toggle-item'}>
                  <TbLayoutGridAdd size={'1.1rem'} />
                </button>
                <button className={'cmp-toolbar__toggle-item'}>
                  <TbLine size={'1.1rem'} />
                </button>
                <button className={'cmp-toolbar__toggle-item'}>
                  <TbTextSize size={'1.1rem'} />
                </button>
                <button className={'cmp-toolbar__toggle-item'}>
                  <TbPencil size={'1.1rem'} />
                </button>
                <button className={'cmp-toolbar__toggle-item'}>
                  <TbPolygon size={'1.1rem'} />
                </button>
              </div>
            </div>

            <div className={'_document'}>
              <DocumentSelector
                diagrams={diagrams}
                defaultValue={defaultDiagram}
                onChange={d => {
                  setDiagram(d);
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
              </div>
            </div>
          </div>
          <div id="window-area">
            <div id="toolbar">
              <Toolbar actionMap={actionMap} keyMap={keyMap} diagram={$d} />
            </div>

            <SideBar side={'left'}>
              <SideBarPage icon={TbCategoryPlus}>
                <PickerToolWindow diagram={$d} />
              </SideBarPage>
              <SideBarPage icon={TbStack2}>
                <LayerToolWindow diagram={$d} />
              </SideBarPage>
              <SideBarPage icon={TbSelectAll}>TbSelectAll</SideBarPage>
              <SideBarPage icon={TbFiles}>TbFiles</SideBarPage>
              <SideBarPage icon={TbHistory}>TbHistory</SideBarPage>
            </SideBar>

            <SideBar side={'right'}>
              <SideBarPage icon={TbInfoCircle}>
                <InfoToolWindow diagram={$d} />
              </SideBarPage>
              <SideBarPage icon={TbPalette}>
                <ObjectProperties diagram={$d} />
              </SideBarPage>
              <SideBarPage icon={TbDatabaseEdit}>TbDatabaseEdit</SideBarPage>
            </SideBar>

            <div id="canvas-area" className={'light-theme'}>
              <ContextMenu.Root>
                <ContextMenu.Trigger asChild={true}>
                  <EditableCanvas
                    key={$d.id}
                    className={'canvas'}
                    diagram={$d}
                    onContextMenu={e => {
                      contextMenuTarget.current = e;
                    }}
                    actionMap={actionMap}
                    keyMap={keyMap}
                    onDrop={canvasDropHandler($d)}
                    onDragOver={canvasDragOverHandler()}
                  />
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content className="cmp-context-menu dark-theme">
                    <ContextMenuDispatcher
                      state={contextMenuTarget}
                      createContextMenu={state => {
                        if (state.contextMenuTarget.type === 'canvas') {
                          return <CanvasContextMenu actionMap={actionMap} keyMap={keyMap} />;
                        } else if (state.contextMenuTarget.type === 'selection') {
                          return <SelectionContextMenu actionMap={actionMap} keyMap={keyMap} />;
                        } else {
                          return (
                            <EdgeContextMenu
                              actionMap={actionMap}
                              keyMap={keyMap}
                              target={state.contextMenuTarget}
                            />
                          );
                        }
                      }}
                    />
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </div>
          </div>
        </div>
      </DragDropManager>
    </div>
  );
};

export default App;
