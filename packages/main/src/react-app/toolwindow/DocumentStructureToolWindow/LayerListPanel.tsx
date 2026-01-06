import { Tree } from '@diagram-craft/app-components/Tree';
import {
  TbAdjustments,
  TbArrowNarrowRight,
  TbBoxMultiple,
  TbEye,
  TbEyeOff,
  TbFilterCog,
  TbLayersSelectedBottom,
  TbLine,
  TbLink,
  TbLock,
  TbLockOff,
  TbPencil,
  TbRectangle,
  TbTable,
  TbTableRow,
  TbTextSize,
  TbTrash
} from 'react-icons/tb';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDraggable, useDropTarget } from '../../hooks/dragAndDropHooks';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { LayerContextMenu } from './LayerContextMenu';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { shorten } from '@diagram-craft/utils/strings';
import { useLayoutEffect, useRef } from 'react';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { addHighlight, removeHighlight } from '@diagram-craft/canvas/highlight';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { RuleContextMenu } from './RuleContextMenu';
import { useApplication, useDiagram } from '../../../application';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ToolWindowPanel } from '../ToolWindowPanel';
import {
  type Modification,
  ModificationLayer
} from '@diagram-craft/model/diagramLayerModification';

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
      onClick={e => {
        if (props.layer.type === 'reference') return;

        UnitOfWork.executeWithUndo(props.diagram, 'Toggle lock', uow => {
          props.layer.setLocked(!props.layer.isLocked(), uow);
        });
        e.preventDefault();
        e.stopPropagation();
      }}
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
      UnitOfWork.executeWithUndo(diagram, 'Change stack', uow => {
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
      });
    },
    {
      split: m => (m === LAYER_INSTANCES ? [0.5, 0, 0.5] : [0, 1, 0])
    }
  );

  return (
    <LayerContextMenu
      layer={layer}
      element={
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
          <Tree.NodeLabel>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.1rem'
              }}
            >
              {layer.type === 'reference' ? <TbLink /> : undefined}
              {layer.resolveForced().type === 'rule' ? <TbAdjustments /> : undefined}
              {layer.type === 'modification' ? <TbLayersSelectedBottom /> : undefined}
              {layer.name}
            </div>
          </Tree.NodeLabel>
          <Tree.NodeCell className="cmp-tree__node__action">
            {layer.type !== 'reference' && layer.type !== 'rule' ? (
              <LockToggle layer={layer} diagram={diagram} />
            ) : (
              ''
            )}
            <VisibilityToggle layer={layer} diagram={diagram} />
          </Tree.NodeCell>
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
              {layer instanceof ModificationLayer && (
                <div style={{ display: 'contents' }}>
                  {layer.modifications.length === 0 ? (
                    <Tree.Node>
                      <Tree.NodeLabel style={{ fontStyle: 'italic' }}>
                        No modifications
                      </Tree.NodeLabel>
                    </Tree.Node>
                  ) : (
                    layer.modifications
                      .toReversed()
                      .map(m => (
                        <ModificationEntry
                          key={m.id}
                          diagram={diagram}
                          modification={m}
                          layer={layer as ModificationLayer}
                        />
                      ))
                  )}
                </div>
              )}
              {!(layer instanceof RegularLayer) &&
                !(layer instanceof RuleLayer) &&
                !(layer instanceof ModificationLayer) && (
                  <div style={{ color: 'red' }}>Not implemented yet</div>
                )}
            </Tree.Children>
          )}
          {layer instanceof ReferenceLayer && (
            <Tree.Children>
              <div style={{ display: 'contents' }}>
                <Tree.Node>
                  <Tree.NodeLabel style={{ fontStyle: 'italic' }}>
                    <TbArrowNarrowRight /> {layer.referenceName()}
                  </Tree.NodeLabel>
                </Tree.Node>
              </div>
            </Tree.Children>
          )}
        </Tree.Node>
      }
    />
  );
};

const RuleEntry = (props: { rule: AdjustmentRule; layer: RuleLayer; diagram: Diagram }) => {
  const e = props.rule;

  const application = useApplication();
  const actions = application.actions;

  const icon = <TbFilterCog />;

  return (
    <RuleContextMenu
      layer={props.layer}
      rule={props.rule}
      element={
        <Tree.Node
          key={e.id}
          onClick={() => {
            const keys = [...props.layer.runRule(props.rule).keys()];
            for (const key of keys) {
              addHighlight(props.diagram.lookup(key)!, 'search-match');
            }
            setTimeout(() => {
              for (const key of keys) {
                removeHighlight(props.diagram.lookup(key), 'search-match');
              }
            }, 1000);
          }}
        >
          <Tree.NodeLabel>
            {icon} &nbsp;{shorten(e.name, 25)}
          </Tree.NodeLabel>
          <Tree.NodeCell className="cmp-tree__node__action">
            <span
              style={{ cursor: 'pointer' }}
              onClick={e => {
                actions['RULE_LAYER_EDIT']!.execute({
                  id: `${props.layer.id}:${props.rule.id}`
                });
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <TbPencil />
            </span>
          </Tree.NodeCell>
        </Tree.Node>
      }
    />
  );
};

const ModificationEntry = (props: {
  modification: Modification;
  layer: ModificationLayer;
  diagram: Diagram;
}) => {
  const m = props.modification;
  const element = m.type === 'remove' ? props.diagram.lookup(m.id) : m.element;

  // Determine icon based on element type (same as ElementEntry)
  let icon = <TbRectangle />;
  if (element) {
    if (isEdge(element)) {
      icon = <TbLine />;
    } else if (isNode(element) && element.nodeType === 'group') {
      icon = <TbBoxMultiple />;
    } else if (isNode(element) && element.nodeType === 'table') {
      icon = <TbTable />;
    } else if (isNode(element) && element.nodeType === 'text') {
      icon = <TbTextSize />;
    } else if (isNode(element) && element.nodeType === 'tableRow') {
      icon = <TbTableRow />;
    }
  }

  // Determine color based on modification type
  let color: string | undefined;
  if (m.type === 'add') {
    color = 'var(--green-9)';
  } else if (m.type === 'remove') {
    color = 'var(--red-9)';
  }

  return (
    <Tree.Node
      key={m.id}
      onClick={() => {
        if (element) {
          addHighlight(element, 'search-match');
          setTimeout(() => {
            removeHighlight(element, 'search-match');
          }, 1000);
        }
      }}
    >
      <Tree.NodeLabel style={{ color }}>
        <Tree.NodeLabelIcon>{icon}</Tree.NodeLabelIcon>
        <Tree.NodeLabelText>{element?.name ?? m.id}</Tree.NodeLabelText>
      </Tree.NodeLabel>
      <Tree.NodeCell className="cmp-tree__node__action">
        <span
          style={{ cursor: 'pointer' }}
          onClick={e => {
            UnitOfWork.executeWithUndo(props.diagram, 'Clear modification', uow => {
              props.layer.clearModification(m.id, uow);
            });
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <TbTrash />
        </span>
      </Tree.NodeCell>
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

      UnitOfWork.executeWithUndo(diagram, 'Change stack', uow => {
        diagram.moveElement(
          instances.map((id: string) => diagram.lookup(id)!),
          uow,
          e.layer,
          {
            relation,
            element: e
          }
        );
      });
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
  } else if (isNode(e) && e.nodeType === 'text') {
    icon = <TbTextSize />;
  } else if (isNode(e) && e.nodeType === 'tableRow') {
    icon = <TbTableRow />;
  }

  return (
    <Tree.Node
      key={e.id}
      data-state={
        diagram.selection.elements.includes(e)
          ? 'on'
          : diagram.selection.getParents().has(e)
            ? 'child'
            : 'off'
      }
      {...drag.eventHandlers}
      {...dropTarget.eventHandlers}
      onClick={() => {
        diagram.selection.clear();
        diagram.selection.toggle(e);
      }}
    >
      <Tree.NodeLabel style={{ gridColumn: '1/4' }}>
        <Tree.NodeLabelIcon>{icon}</Tree.NodeLabelIcon>
        <Tree.NodeLabelText>{e.name}</Tree.NodeLabelText>
      </Tree.NodeLabel>

      {(childrenAllowed || (isEdge(e) && e.children.length > 0)) && (
        <Tree.Children>
          {e.children.toReversed().map(c => (
            <ElementEntry key={c.id} element={c} />
          ))}
        </Tree.Children>
      )}
    </Tree.Node>
  );
};

export const LayerListPanel = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();
  const ref = useRef<HTMLDivElement>(null);

  const names = Object.fromEntries(
    diagram.layers.all.flatMap(l =>
      l instanceof RegularLayer ? l.elements.map(e => [e.id, e.name]) : []
    )
  );

  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'diagramChange', redraw);

  useEventListener(diagram.layers, 'layerAdded', redraw);
  useEventListener(diagram.layers, 'layerUpdated', redraw);
  useEventListener(diagram.layers, 'layerRemoved', redraw);
  useEventListener(diagram.layers, 'layerStructureChange', redraw);

  useEventListener(diagram, 'elementChange', ({ element }) => {
    if (names[element.id] !== element.name) {
      redraw();
    }
  });
  useEventListener(diagram, 'elementRemove', ({ element }) => {
    if (names[element.id] !== element.name) {
      redraw();
    }
  });
  useEventListener(diagram.selection, 'add', redraw);
  useEventListener(diagram.selection, 'remove', redraw);

  useLayoutEffect(() => {
    // Scroll first element with data-state="on" into view
    const selected = ref.current?.querySelector('[data-state="on"]');
    if (!selected) return;
    selected.scrollIntoView({ block: 'nearest' });
  });

  return (
    <ToolWindowPanel
      mode={'headless-no-padding'}
      id={'layer'}
      title={'Layer'}
      style={{ padding: '0.25rem 0' }}
    >
      <Tree.Root
        ref={ref}
        className={'cmp-layer-list'}
        data-dragmimetype={'application/x-diagram-craft-element-instances'}
      >
        {layers.map(l => (
          <LayerEntry key={l.id} layer={l} />
        ))}
      </Tree.Root>
      <LayerContextMenu element={<div style={{ height: '100%' }}></div>} />
    </ToolWindowPanel>
  );
};
