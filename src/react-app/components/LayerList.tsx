import { useDiagram } from '../context/DiagramContext.tsx';
import * as Tree from './Tree.tsx';
import { TbEye, TbEyeOff } from 'react-icons/tb';
import { Diagram } from '../../model/diagram.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { reversed } from '../../utils/array.ts';
import React, { useRef } from 'react';
import { Box } from '../../geometry/box.ts';

const isAbove = (clientY: number, rect: DOMRect) => clientY < rect.top + rect.height / 2;

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

class Indicator {
  constructor(private readonly ref: React.RefObject<HTMLDivElement>) {}
  hide() {
    this.ref.current!.style.visibility = 'hidden';
  }
  move(rect: { width: number; left: number; top: number; height: number }, at: 'top' | 'bottom') {
    const indicator = this.ref.current!;
    indicator.style.visibility = 'visible';
    indicator.style.width = `${rect.width}px`;
    indicator.style.left = `${rect.left}px`;
    indicator.style.top = `${rect.top + (at === 'top' ? 0 : rect.height)}px`;
  }
}

export const LayerList = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = reversed(diagram.layers.all);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEventListener(diagram, 'change', redraw);

  const indicator = new Indicator(indicatorRef);

  return (
    <div style={{ margin: '-10px' }} className={'cmp-layer-list'}>
      <div ref={indicatorRef} className={'cmp-layer-list__drag-indicator'}></div>
      <Tree.Root onDragLeave={() => indicator.hide()}>
        {layers.map(l => (
          <Tree.Node
            key={l.id}
            isOpen={true}
            className={diagram.layers.active === l ? 'cmp-layer-list__layer--selected' : ''}
            draggable
            onDragStart={ev => {
              ev.dataTransfer.setData(LAYER_INSTANCES, JSON.stringify([l.id]));
              ev.dataTransfer.dropEffect = 'move';
            }}
            onClick={() => {
              diagram.layers.active = l;
            }}
            onDragOver={ev => {
              const drag = ev.dataTransfer;
              if (drag.types.includes(ELEMENT_INSTANCES) || drag.types.includes(LAYER_INSTANCES)) {
                drag.dropEffect = 'move';

                const he = ev.currentTarget;

                if (drag.types.includes(ELEMENT_INSTANCES)) {
                  indicator.move(he.getBoundingClientRect(), 'bottom');
                  ev.preventDefault();
                } else if (drag.types.includes(LAYER_INSTANCES)) {
                  const rects = [
                    Box.fromElement(he),
                    ...[...(he.nextSibling as HTMLElement).children].map(e => Box.fromElement(e))
                  ];

                  const rect = Box.asDomRect(Box.boundingBox(rects));

                  indicator.move(
                    rect,
                    isAbove(ev.clientY, he.getBoundingClientRect()) ? 'top' : 'bottom'
                  );
                  ev.preventDefault();
                }
              }
            }}
            onDragEnter={e => {
              e.currentTarget.style.background = 'var(--secondary-bg)';
              e.currentTarget.classList.add('util-disable-nested-pointer-events');
            }}
            onDragLeave={e => {
              e.currentTarget.style.background = 'unset';
              e.currentTarget.classList.remove('util-disable-nested-pointer-events');
            }}
            onDragEnd={() => {
              indicator.hide();
            }}
            onDrop={ev => {
              const he = ev.currentTarget;
              he.style.background = 'unset';

              if (ev.dataTransfer.types.includes(ELEMENT_INSTANCES)) {
                diagram.moveElement(
                  JSON.parse(ev.dataTransfer.getData(ELEMENT_INSTANCES)!).map(
                    (id: string) => diagram.nodeLookup[id] ?? diagram.edgeLookup[id]
                  ),
                  l
                );
              } else {
                diagram.layers.move(
                  JSON.parse(ev.dataTransfer.getData(LAYER_INSTANCES)!).map((id: string) =>
                    diagram.layers.byId(id)
                  ),
                  {
                    relation: isAbove(ev.clientY, he.getBoundingClientRect()) ? 'above' : 'below',
                    layer: l
                  }
                );
              }
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
                    draggable
                    onDragStart={ev => {
                      ev.dataTransfer.setData(ELEMENT_INSTANCES, JSON.stringify([e.id]));
                      ev.dataTransfer.dropEffect = 'move';
                    }}
                    onDragOver={e => {
                      if (!e.dataTransfer.types.includes(ELEMENT_INSTANCES)) return;

                      e.dataTransfer.dropEffect = 'move';

                      const he = e.currentTarget;

                      const rect = he.getBoundingClientRect();
                      indicator.move(rect, isAbove(e.clientY, rect) ? 'top' : 'bottom');

                      e.preventDefault();
                    }}
                    onDragEnter={e => {
                      e.currentTarget.style.background = 'var(--secondary-bg)';
                      e.currentTarget.classList.add('util-disable-nested-pointer-events');
                    }}
                    onDragLeave={e => {
                      e.currentTarget.style.background = 'unset';
                      e.currentTarget.classList.remove('util-disable-nested-pointer-events');
                    }}
                    onDragEnd={() => {
                      indicator.hide();
                    }}
                    onDrop={ev => {
                      const he = ev.currentTarget;
                      he.style.background = 'unset';

                      const brect = he.getBoundingClientRect();
                      diagram.moveElement(
                        JSON.parse(ev.dataTransfer.getData(ELEMENT_INSTANCES)!).map(
                          (id: string) => diagram.nodeLookup[id] ?? diagram.edgeLookup[id]
                        ),
                        e.layer!,
                        {
                          relation: isAbove(ev.clientY, brect) ? 'above' : 'below',
                          element: e
                        }
                      );
                    }}
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
