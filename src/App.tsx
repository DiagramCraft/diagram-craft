import './App.css';
import { deserializeDiagram } from './model-viewer/serialization.ts';
import { Canvas } from './canvas/Canvas.tsx';
import { useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';
import { ToolWindowButton } from './app/ToolWindowButton.tsx';
import { EditableDiagram } from './model-editor/editable-diagram.ts';
import { InfoToolWindow } from './app/InfoToolWindow.tsx';
import { LayerToolWindow } from './app/LayerToolWindow.tsx';
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

  //useEffect(() => {
  //  perftest(new SnapManagerPerftest());
  //}, []);

  return (
    <div id="app">
      <div id="menu">
        <select
          onChange={e => {
            setSelectedDiagram(Number(e.target.value));
          }}
        >
          {diagrams.map((d, idx) => (
            <option key={idx} value={idx} selected={selectedDiagram === idx}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div id="toolbar">
        <ToolBarGroup label={'Snap:'}>
          <ToolBarButton icon={TbGrid3X3} />
          <ToolBarButton icon={TbLayout} />
          <ToolBarButton icon={TbPlus} />
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
        {/*<div className={'cmp-tool-window-accordion'}>
          <div className={'cmp-tool-window-accordion__header'}>Layers</div>
          <div className={'cmp-tool-window-accordion__content'}>Content</div>
        </div>

        <div className={'cmp-tool-window-accordion'}>
          <div className={'cmp-tool-window-accordion__header'}>Sample 2</div>
          <div className={'cmp-tool-window-accordion__content'}>
            <div className={'cmp-tool-window-accordion__header__tabs'}>
              <div className={'cmp-tool-window-accordion__header__tab'}>Tab 1</div>
              <div
                className={
                  'cmp-tool-window-accordion__header__tab cmp-tool-window-accordion__header__tab--active'
                }
              >
                Tab 2
              </div>
              <div className={'cmp-tool-window-accordion__header__tab'}>Tab 3</div>
            </div>
            <div>Content</div>
          </div>
        </div>*/}
      </div>

      <div id="middle">
        <Canvas key={selectedDiagram} diagram={$d} />
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
