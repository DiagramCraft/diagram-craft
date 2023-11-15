import './App.css';
import { deserializeDiagram } from './model/serialization.ts';
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
    <div>
      <Canvas key={selectedDiagram} diagram={$d} />

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
  );
};

export default App;
