import './App.css';
import { Diagram, loadDiagram } from './diagram.ts';
import { Canvas } from './Canvas.tsx';
import { useEffect } from 'react';

const diagram: Diagram = {
  elements: [
    {
      type: 'edge',
      id: 'e1',
      start: { anchor: 'c', node: { id: '1_2' } },
      end: { anchor: 'c', node: { id: '2' } }
    },
    {
      type: 'node',
      nodeType: 'group',
      id: '1',
      pos: { x: 50, y: 50 },
      size: { w: 100, h: 100 },
      children: [
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_1',
          pos: { x: 10, y: 10 },
          size: { w: 20, h: 20 },
          children: []
        },
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_2',
          pos: { x: 50, y: 50 },
          size: { w: 40, h: 40 },
          children: []
        }
      ]
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '2',
      pos: { x: 400, y: 220 },
      size: { w: 100, h: 100 },
      children: []
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '3',
      pos: { x: 370, y: 20 },
      size: { w: 100, h: 100 },
      children: []
    }
  ]
};

const $d = loadDiagram(diagram);

const App = () => {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ') {
        if (e.metaKey && e.shiftKey) {
          $d.undoManager.redo();
        } else if (e.metaKey) {
          $d.undoManager.undo();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, []);
  return <Canvas diagram={$d} />;
};

export default App;
