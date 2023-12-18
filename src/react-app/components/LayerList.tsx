import { useDiagram } from '../context/DiagramContext.tsx';
import * as Tree from './Tree.tsx';
import { TbEye, TbEyeOff, TbLock, TbLockOff } from 'react-icons/tb';
import { Diagram } from '../../model/diagram.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { reversed } from '../../utils/array.ts';
import { DiagramElement } from '../../model/diagramNode.ts';
import { useDraggable, useDropTarget } from './dragAndDropHooks.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';

const ELEMENT_INSTANCES = 'application/x-diagram-craft-element-instances';
const LAYER_INSTANCES = 'application/x-diagram-craft-layer-instances';

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

const LockToggle = (props: { layer: Layer; diagram: Diagram }) => {
  return (
    <span
      style={{ cursor: 'pointer' }}
      onClick={e => {
        props.layer.locked = !props.layer.isLocked();
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {props.layer.isLocked() ? <TbLock /> : <TbLockOff />}
    </span>
  );
};

type LayerEntryProps = { layer: Layer };
const LayerEntry = (props: LayerEntryProps) => {
  const diagram = useDiagram();
  const layer = props.layer;

  const drag = useDraggable(JSON.stringify([layer.id]), LAYER_INSTANCES);
  const dropTarget = useDropTarget(
    [LAYER_INSTANCES, ELEMENT_INSTANCES],
    ev => {
      if (ev[ELEMENT_INSTANCES]) {
        diagram.moveElement(
          JSON.parse(ev[ELEMENT_INSTANCES].on!).map(
            (id: string) => diagram.nodeLookup[id] ?? diagram.edgeLookup[id]
          ),
          layer
        );
      } else {
        let relation: 'above' | 'below' = 'below';
        const instances: string[] = [];
        if (ev[LAYER_INSTANCES].before) {
          instances.push(...JSON.parse(ev[LAYER_INSTANCES].before));
          relation = 'above';
        } else if (ev[LAYER_INSTANCES].after) {
          instances.push(...JSON.parse(ev[LAYER_INSTANCES].after));
          relation = 'below';
        } else {
          VERIFY_NOT_REACHED();
        }

        diagram.layers.move(
          instances.map((id: string) => diagram.layers.byId(id)!),
          { relation, layer: layer }
        );
      }
    },
    {
      split: m => (m === LAYER_INSTANCES ? [0.5, 0, 0.5] : [0, 1, 0])
    }
  );

  return (
    <Tree.Node
      key={layer.id}
      isOpen={true}
      className={diagram.layers.active === layer ? 'cmp-layer-list__layer--selected' : ''}
      {...drag.eventHandlers}
      {...dropTarget.eventHandlers}
      onClick={() => {
        diagram.layers.active = layer;
      }}
    >
      <Tree.NodeLabel>{layer.name}</Tree.NodeLabel>
      <Tree.NodeValue>{diagram.layers.active === layer ? 'Active' : ''}</Tree.NodeValue>
      <Tree.NodeAction style={{ display: 'flex', gap: '0.35rem' }}>
        <LockToggle layer={layer} diagram={diagram} />
        <VisibilityToggle layer={layer} diagram={diagram} />
      </Tree.NodeAction>
      <Tree.Children>
        <div style={{ display: 'contents' }}>
          {reversed(layer.elements).map(e => (
            <ElementEntry key={e.id} element={e} />
          ))}
        </div>
      </Tree.Children>
    </Tree.Node>
  );
};

type ElementEntryProps = { element: DiagramElement };
const ElementEntry = (props: ElementEntryProps) => {
  const diagram = useDiagram();
  const e = props.element;

  const drag = useDraggable(JSON.stringify([e.id]), ELEMENT_INSTANCES);
  const dropTarget = useDropTarget(
    [ELEMENT_INSTANCES],
    ev => {
      let relation: 'above' | 'below' = 'below';
      const instances: string[] = [];
      if (ev[ELEMENT_INSTANCES].before) {
        instances.push(...JSON.parse(ev[ELEMENT_INSTANCES].before));
        relation = 'above';
      } else if (ev[ELEMENT_INSTANCES].after) {
        instances.push(...JSON.parse(ev[ELEMENT_INSTANCES].after));
        relation = 'below';
      } else {
        VERIFY_NOT_REACHED();
      }

      diagram.moveElement(
        instances.map((id: string) => diagram.nodeLookup[id] ?? diagram.edgeLookup[id]),
        e.layer!,
        {
          relation,
          element: e
        }
      );
    },
    {
      split: () => [0.5, 0, 0.5]
    }
  );

  return (
    <Tree.Node
      key={e.id}
      data-state={diagram.selectionState.elements.includes(e) ? 'on' : 'off'}
      {...drag.eventHandlers}
      {...dropTarget.eventHandlers}
      onClick={() => {
        diagram.selectionState.clear();
        diagram.selectionState.toggle(e);
      }}
    >
      <Tree.NodeLabel>{e.type === 'node' ? e.nodeType : e.id}</Tree.NodeLabel>
    </Tree.Node>
  );
};

export const LayerList = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = reversed(diagram.layers.all);

  useEventListener(diagram, 'change', redraw);

  return (
    <div style={{ margin: '-10px' }} className={'cmp-layer-list'}>
      <Tree.Root data-dragmimetype={'application/x-diagram-craft-element-instances'}>
        {layers.map(l => (
          <LayerEntry key={l.id} layer={l} />
        ))}
      </Tree.Root>
    </div>
  );
};
