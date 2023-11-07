import './App.css';
import { SerializedDiagram } from './model/serialization.ts';
import { deserializeDiagram } from './model/serialization.ts';
import { Canvas } from './Canvas.tsx';
import { useEffect } from 'react';

const diagram: SerializedDiagram = {
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
      bounds: {
        pos: { x: 50, y: 50 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      children: [
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_1',
          bounds: {
            pos: { x: 10, y: 10 },
            size: { w: 20, h: 20 },
            rotation: 0
          },
          children: []
        },
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_2',
          bounds: {
            pos: { x: 50, y: 50 },
            size: { w: 40, h: 40 },
            rotation: 0
          },
          children: []
        }
      ]
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '2',
      bounds: {
        pos: { x: 400, y: 220 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      children: []
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '3',
      bounds: {
        pos: { x: 370, y: 20 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      children: []
    }
  ]
};

const $d = deserializeDiagram(diagram);

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
