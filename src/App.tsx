import './App.css';
import { deserializeDiagram } from './model-viewer/serialization.ts';
import { Canvas } from './canvas/Canvas.tsx';
import { useState } from 'react';
import { snapTestDiagram } from './sample/snap-test.ts';
import { simpleDiagram } from './sample/simple.ts';

const diagrams = [
  {
    name: 'Snap test',
    diagram: deserializeDiagram(snapTestDiagram)
  },
  {
    name: 'Simple',
    diagram: deserializeDiagram(simpleDiagram)
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
      <div id="left">
        <select
          onChange={e => {
            setSelectedDiagram(Number(e.target.value));
          }}
        >
          {diagrams.map((d, idx) => (
            <option key={idx} value={idx}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div id="middle">
        <Canvas key={selectedDiagram} diagram={$d} />
      </div>

      <div id="right">Right</div>
    </div>
  );
};

export default App;
