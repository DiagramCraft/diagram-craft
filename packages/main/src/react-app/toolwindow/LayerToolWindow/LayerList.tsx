import { useDiagram } from '../../context/DiagramContext';
import { Tree } from '@diagram-craft/app-components/Tree';
import {
  TbAdjustments,
  TbBoxMultiple,
  TbEye,
  TbEyeOff,
  TbFilterCog,
  TbLine,
  TbLink,
  TbLock,
  TbLockOff,
  TbRectangle,
  TbTable,
  TbTableRow
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDraggable, useDropTarget } from '../../hooks/dragAndDropHooks';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { LayerContextMenu } from './LayerContextMenu';
import { Layer, RegularLayer } from '@diagram-craft/model/diagramLayer';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { shorten } from '@diagram-craft/utils/strings';
import { useLayoutEffect, useRef } from 'react';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { AdjustmentRule, RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { addHighlight, removeHighlight } from '@diagram-craft/canvas/highlight';

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
      style={{ cursor: props.layer.type === 'reference' ? 'inherit' : 'pointer' }}
      onClick={
        props.layer.type === 'reference'
          ? undefined
          : e => {
              props.layer.locked = !props.layer.isLocked();
              e.preventDefault();
              e.stopPropagation();
            }
      }
    >
      {props.layer.isLocked() ? <TbLock /> : <TbLockOff />}
    </span>
  );
};

const LayerEntry = (props: { layer: Layer }) => {
  const diagram = useDiagram();
  const layer = props.layer;

  const drag = useDraggable(JSON.stringify([layer.id]), LAYER_INSTANCES);
  const dropTarget = useDropTarget(
    [LAYER_INSTANCES, ELEMENT_INSTANCES],
    ev => {
      const uow = new UnitOfWork(diagram, true);
      if (ev[ELEMENT_INSTANCES]) {
        diagram.moveElement(
          JSON.parse(ev[ELEMENT_INSTANCES].on!).map((id: string) => diagram.lookup(id)),
          uow,
          layer
        );
      } else if (ev[LAYER_INSTANCES]) {
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
          uow,
          { relation, layer: layer }
        );
      }

      commitWithUndo(uow, 'Change stack');
    },
    {
      split: m => (m === LAYER_INSTANCES ? [0.5, 0, 0.5] : [0, 1, 0])
    }
  );

  return (
    <LayerContextMenu layer={layer}>
      <Tree.Node
        key={layer.id}
        isOpen={true}
        className={diagram.activeLayer === layer ? 'cmp-layer-list__layer--selected' : ''}
        {...drag.eventHandlers}
        {...dropTarget.eventHandlers}
        onClick={() => {
          diagram.layers.active = layer;
        }}
      >
        <Tree.NodeLabel>{layer.name}</Tree.NodeLabel>
        <Tree.NodeAction style={{ display: 'flex', gap: '0.35rem' }}>
          {layer.type === 'adjustment' ? (
            <div style={{ color: 'var(--blue-11)' }}>
              <TbAdjustments />
            </div>
          ) : layer.type === 'reference' ? (
            <div style={{ color: 'var(--blue-11)' }}>
              <TbLink />
            </div>
          ) : (
            ''
          )}
          {layer.type !== 'reference' ? <LockToggle layer={layer} diagram={diagram} /> : ''}
          <VisibilityToggle layer={layer} diagram={diagram} />
        </Tree.NodeAction>
        {!(layer instanceof ReferenceLayer) && (
          <Tree.Children>
            {layer instanceof RegularLayer && (
              <div style={{ display: 'contents' }}>
                {layer.elements.toReversed().map(e => (
                  <ElementEntry key={e.id} element={e} />
                ))}
              </div>
            )}
            {layer instanceof RuleLayer && (
              <div style={{ display: 'contents' }}>
                {layer.rules.toReversed().map(e => (
                  <RuleEntry key={e.id} diagram={diagram} rule={e} layer={layer} />
                ))}
              </div>
            )}
            {!(layer instanceof RegularLayer) && !(layer instanceof RuleLayer) && (
              <div style={{ color: 'red' }}>Not implemented yet</div>
            )}
          </Tree.Children>
        )}
      </Tree.Node>
    </LayerContextMenu>
  );
};

const RuleEntry = (props: { rule: AdjustmentRule; layer: RuleLayer; diagram: Diagram }) => {
  const e = props.rule;

  const icon = <TbFilterCog />;

  return (
    <Tree.Node
      key={e.id}
      onClick={() => {
        const keys = [...props.layer.runRule(props.rule).keys()];
        for (const key of keys) {
          addHighlight(props.diagram.lookup(key)!, 'search-match');
        }
        setTimeout(() => {
          for (const key of keys) {
            removeHighlight(props.diagram.lookup(key)!, 'search-match');
          }
        }, 1000);
      }}
    >
      <Tree.NodeLabel>
        {icon} &nbsp;{shorten(e.name, 25)}
      </Tree.NodeLabel>
    </Tree.Node>
  );
};

const ElementEntry = (props: { element: DiagramElement }) => {
  const diagram = useDiagram();
  const e = props.element;

  const childrenAllowed =
    isNode(e) && diagram.document.nodeDefinitions.get(e.nodeType).supports('children');

  const drag = useDraggable(JSON.stringify([e.id]), ELEMENT_INSTANCES);
  const dropTarget = useDropTarget(
    [ELEMENT_INSTANCES],
    ev => {
      let relation: 'above' | 'below' | 'on' = 'below';
      const instances: string[] = [];
      if (ev[ELEMENT_INSTANCES]!.before) {
        instances.push(...JSON.parse(ev[ELEMENT_INSTANCES]!.before));
        relation = 'above';
      } else if (ev[ELEMENT_INSTANCES]!.after) {
        instances.push(...JSON.parse(ev[ELEMENT_INSTANCES]!.after));
        relation = 'below';
      } else if (ev[ELEMENT_INSTANCES]!.on) {
        instances.push(...JSON.parse(ev[ELEMENT_INSTANCES]!.on));
        relation = 'on';
      } else {
        VERIFY_NOT_REACHED();
      }

      const uow = new UnitOfWork(diagram, true);
      diagram.moveElement(
        instances.map((id: string) => diagram.lookup(id)!),
        uow,
        e.layer,
        {
          relation,
          element: e
        }
      );

      commitWithUndo(uow, 'Change stack');
    },
    {
      split: () => (childrenAllowed ? [0.25, 0.5, 0.25] : [0.5, 0, 0.5])
    }
  );

  let icon = <TbRectangle />;
  if (isEdge(e)) {
    icon = <TbLine />;
  } else if (isNode(e) && e.nodeType === 'group') {
    icon = <TbBoxMultiple />;
  } else if (isNode(e) && e.nodeType === 'table') {
    icon = <TbTable />;
  } else if (isNode(e) && e.nodeType === 'tableRow') {
    icon = <TbTableRow />;
  }

  return (
    <Tree.Node
      key={e.id}
      data-state={
        diagram.selectionState.elements.includes(e)
          ? 'on'
          : diagram.selectionState.getParents().has(e)
            ? 'child'
            : 'off'
      }
      {...drag.eventHandlers}
      {...dropTarget.eventHandlers}
      onClick={() => {
        diagram.selectionState.clear();
        diagram.selectionState.toggle(e);
      }}
    >
      <Tree.NodeLabel>
        {icon} &nbsp;{shorten(e.name, 25)}
      </Tree.NodeLabel>

      {childrenAllowed && (
        <Tree.Children>
          {e.children.toReversed().map(c => (
            <ElementEntry key={c.id} element={c} />
          ))}
        </Tree.Children>
      )}
    </Tree.Node>
  );
};

export const LayerList = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const ref = useRef<HTMLDivElement>(null);

  const names = Object.fromEntries(
    diagram.layers.all.flatMap(l =>
      l instanceof RegularLayer ? l.elements.map(e => [e.id, e.name]) : []
    )
  );

  useEventListener(diagram, 'change', redraw);
  useEventListener(diagram, 'elementChange', ({ element }) => {
    if (names[element.id] !== element.name) {
      redraw();
    }
  });
  useEventListener(diagram.selectionState, 'add', redraw);
  useEventListener(diagram.selectionState, 'remove', redraw);

  useLayoutEffect(() => {
    // Scroll first element with data-state="on" into view
    const selected = ref.current?.querySelector('[data-state="on"]');
    if (!selected) return;
    selected.scrollIntoView({ block: 'nearest' });
  });

  return (
    <>
      <Tree.Root
        ref={ref}
        className={'cmp-layer-list'}
        data-dragmimetype={'application/x-diagram-craft-element-instances'}
      >
        {layers.map(l => (
          <LayerEntry key={l.id} layer={l} />
        ))}
      </Tree.Root>
      <LayerContextMenu>
        <div style={{ height: '100%' }}></div>
      </LayerContextMenu>
    </>
  );
};
