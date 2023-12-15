import { useDiagram } from '../context/DiagramContext.tsx';
import * as Tree from './Tree.tsx';
import { TbEyeOff, TbEye } from 'react-icons/tb';
import { Diagram } from '../../model/diagram.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';

function reversed<T>(l: T[]): T[] {
  return [...l].reverse();
}

const VisibilityToggle = (props: { layer: Layer; diagram: Diagram }) => {
  return (
    <span
      style={{ cursor: 'pointer' }}
      onClick={e => {
        props.diagram.layers.toggleVisibility(props.layer);
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {props.diagram.layers.visible.includes(props.layer) ? <TbEye /> : <TbEyeOff />}
    </span>
  );
};

export const LayerList = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = reversed(diagram.layers.all);

  useEventListener(diagram, 'change', redraw);

  return (
    <div style={{ margin: '-10px' }} className={'cmp-layer-list'}>
      <Tree.Root>
        {layers.map(l => (
          <Tree.Node
            key={l.id}
            isOpen={true}
            className={diagram.layers.active === l ? 'cmp-layer-list__layer--selected' : ''}
            onClick={() => {
              diagram.layers.active = l;
            }}
          >
            <Tree.NodeLabel>{l.name}</Tree.NodeLabel>
            <Tree.NodeValue>{diagram.layers.active === l ? 'Active' : ''}</Tree.NodeValue>
            <Tree.NodeAction>
              <VisibilityToggle layer={l} diagram={diagram} />
            </Tree.NodeAction>
            <Tree.Children>
              <div style={{ display: 'contents' }}>
                {reversed(l.elements).map(e => (
                  <Tree.Node
                    key={e.id}
                    data-state={diagram.selectionState.elements.includes(e) ? 'on' : 'off'}
                    onClick={() => {
                      diagram.selectionState.clear();
                      diagram.selectionState.toggle(e);
                    }}
                  >
                    <Tree.NodeLabel>{e.type === 'node' ? e.nodeType : e.id}</Tree.NodeLabel>
                  </Tree.Node>
                ))}
              </div>
            </Tree.Children>
          </Tree.Node>
        ))}
      </Tree.Root>
    </div>
  );
};
