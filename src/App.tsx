import './App.css';
import { deserializeDiagram } from './model-viewer/serialization.ts';
import { ContextMenuTarget, EditableCanvas } from './react-canvas-editor/EditableCanvas.tsx';
import { useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { EditableDiagram } from './model-editor/editable-diagram.ts';
import { InfoToolWindow } from './react-app/InfoToolWindow.tsx';
import { LayerToolWindow } from './react-app/LayerToolWindow.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  TbCategoryPlus,
  TbDatabaseEdit,
  TbFiles,
  TbHistory,
  TbInfoCircle,
  TbPalette,
  TbSelectAll,
  TbStack2
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

const diagrams = [
  {
    name: 'Snap test',
    diagram: new EditableDiagram(
      deserializeDiagram(snapTestDiagram),
      defaultNodeRegistry(),
      defaultEdgeRegistry()
    )
  },
  {
    name: 'Simple',
    diagram: new EditableDiagram(
      deserializeDiagram(simpleDiagram),
      defaultNodeRegistry(),
      defaultEdgeRegistry()
    )
  }
];

const App = () => {
  const [selectedDiagram, setSelectedDiagram] = useState(1);
  const $d = diagrams[selectedDiagram].diagram;
  const contextMenuTarget = useRef<ContextMenuTarget | null>(null);

  //useEffect(() => {
  //  perftest(new SnapManagerPerftest());
  //}, []);

  const actionMap = makeActionMap(defaultCanvasActions)({ diagram: $d });
  const keyMap = defaultMacKeymap;
  return (
    <DragDropManager>
      <div id="app" className={'dark-theme'}>
        <div id="menu">
          <select
            onChange={e => {
              setSelectedDiagram(Number(e.target.value));
            }}
            defaultValue={selectedDiagram}
          >
            {diagrams.map((d, idx) => (
              <option key={idx} value={idx}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div id="toolbar">
          <Toolbar actionMap={actionMap} keyMap={keyMap} />
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
          <SideBarPage icon={TbPalette}>TbPalette</SideBarPage>
          <SideBarPage icon={TbDatabaseEdit}>TbDatabaseEdit</SideBarPage>
        </SideBar>

        <div id="middle" className={'light-theme'}>
          <ContextMenu.Root>
            <ContextMenu.Trigger asChild={true}>
              <EditableCanvas
                key={selectedDiagram}
                diagram={$d}
                onContextMenu={e => {
                  contextMenuTarget.current = e.contextMenuTarget;
                }}
                actionMap={actionMap}
                keyMap={keyMap}
                onDrop={canvasDropHandler($d)}
                onDragOver={canvasDragOverHandler()}
              />
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="ContextMenuContent dark-theme">
                <ContextMenuDispatcher
                  state={contextMenuTarget}
                  createContextMenu={state => {
                    if (state.type === 'canvas') {
                      return <CanvasContextMenu actionMap={actionMap} keyMap={keyMap} />;
                    } else {
                      return <SelectionContextMenu actionMap={actionMap} keyMap={keyMap} />;
                    }
                  }}
                />
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </div>
      </div>
    </DragDropManager>
  );
};

export default App;
