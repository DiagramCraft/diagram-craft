import './App.css';
import { deserializeDiagram } from './model-viewer/serialization.ts';
import { Canvas, ContextMenuTarget } from './canvas/Canvas.tsx';
import { useRef, useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { ToolWindowButton } from './app/ToolWindowButton.tsx';
import { EditableDiagram } from './model-editor/editable-diagram.ts';
import { InfoToolWindow } from './app/InfoToolWindow.tsx';
import { LayerToolWindow } from './app/LayerToolWindow.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  TbArrowAutofitWidth,
  TbArrowsMoveHorizontal,
  TbBorderInner,
  TbCategoryPlus,
  TbDatabaseEdit,
  TbFiles,
  TbGrid3X3,
  TbHistory,
  TbInfoCircle,
  TbLayout,
  TbLayoutAlignBottom,
  TbLayoutAlignCenter,
  TbLayoutAlignLeft,
  TbLayoutAlignMiddle,
  TbLayoutAlignRight,
  TbLayoutAlignTop,
  TbLayoutDistributeHorizontal,
  TbLayoutDistributeVertical,
  TbPalette,
  TbPlus,
  TbSelectAll,
  TbStack2
} from 'react-icons/tb';
import { ToolBarButton } from './app/ToolBarButton.tsx';
import { ToolBarGroup } from './app/ToolBarGroup.tsx';
import { CanvasContextMenu } from './app/context-menu/CanvasContextMenu.tsx';
import { ContextMenuDispatcher } from './app/context-menu/ContextMenuDispatcher.tsx';
import { SelectionContextMenu } from './app/context-menu/SelectionContextMenu.tsx';
import { defaultCanvasActions, defaultMacKeymap, makeActionMap } from './canvas/keyMap.ts';

const diagrams = [
  {
    name: 'Snap test',
    diagram: new EditableDiagram(deserializeDiagram(snapTestDiagram))
  },
  {
    name: 'Simple',
    diagram: new EditableDiagram(deserializeDiagram(simpleDiagram))
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
        <ToolBarGroup label={'Snap:'}>
          <ToolBarButton icon={TbGrid3X3} />
          <ToolBarButton icon={TbLayout} isSelected />
          <ToolBarButton icon={TbPlus} isSelected />
          <ToolBarButton icon={TbArrowsMoveHorizontal} />
          <ToolBarButton icon={TbArrowAutofitWidth} />
          <ToolBarButton icon={TbBorderInner} />
        </ToolBarGroup>

        <ToolBarGroup label={'Align:'}>
          <ToolBarButton icon={TbLayoutAlignTop} />
          <ToolBarButton icon={TbLayoutAlignBottom} />
          <ToolBarButton icon={TbLayoutAlignLeft} />
          <ToolBarButton icon={TbLayoutAlignRight} />
          <ToolBarButton icon={TbLayoutAlignCenter} />
          <ToolBarButton icon={TbLayoutAlignMiddle} />
          <ToolBarButton icon={TbLayoutDistributeHorizontal} />
          <ToolBarButton icon={TbLayoutDistributeVertical} />
        </ToolBarGroup>
      </div>

      <div id="left-buttons">
        <ToolWindowButton icon={TbCategoryPlus} />
        <ToolWindowButton icon={TbStack2} isSelected />
        <ToolWindowButton icon={TbSelectAll} />
        <ToolWindowButton icon={TbFiles} />
        <ToolWindowButton icon={TbHistory} />
      </div>
      <div id="left">
        <LayerToolWindow diagram={$d} />
      </div>

      <div id="middle" className={'light-theme'}>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild={true}>
            <Canvas
              key={selectedDiagram}
              diagram={$d}
              onContextMenu={e => {
                contextMenuTarget.current = e.contextMenuTarget;
              }}
              actionMap={actionMap}
              keyMap={keyMap}
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

      <div id="right-buttons">
        <ToolWindowButton icon={TbInfoCircle} isSelected />
        <ToolWindowButton icon={TbPalette} />
        <ToolWindowButton icon={TbDatabaseEdit} />
      </div>
      <div id="right">
        <InfoToolWindow diagram={$d} />
      </div>
    </div>
  );
};

export default App;
