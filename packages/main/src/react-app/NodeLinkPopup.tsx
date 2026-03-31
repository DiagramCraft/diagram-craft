import { PickerCanvas } from './PickerCanvas';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import type { EdgeStylesheet } from '@diagram-craft/model/diagramStyles';
import {
  NODE_LINK_POPUP_NO_SHAPE_ID,
  type NodeLinkEdgeStyle,
  type NodeLinkOptions
} from '@diagram-craft/model/stencilRegistry';
import { deepMerge } from '@diagram-craft/utils/object';
import { ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { addStencilStylesToDocument, applyStencilToNode } from '@diagram-craft/model/stencilUtils';
import {
  copyStyles,
  getStencilsInPackage,
  Stencil,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { CompoundUndoableAction, type UndoableAction } from '@diagram-craft/model/undoManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { isNode } from '@diagram-craft/model/diagramElement';
import { unique } from '@diagram-craft/utils/array';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../application';
import { useEventListener } from './hooks/useEventListener';
import { useRedraw } from './hooks/useRedraw';
import { createPreview } from './toolwindow/StyleOverviewToolWindow/stylesPanelUtils';
import styles from './NodeLinkPopup.module.css';
import objectPickerStyles from './ObjectPicker.module.css';
import { LineEndIcon } from './icons/LineEndIcon';
import { createProvisionalLinkedNode } from '@diagram-craft/canvas/linkedNode';

const EDGE_LIMIT = 8;
const NODE_LIMIT = 16;
const REQUIRED_NODE_STENCIL_IDS = ['default@@text', 'default@@rect'];

const NODE_LINK_POPUP_MARK = 'node-link-popup';
const NO_SHAPE_ID = NODE_LINK_POPUP_NO_SHAPE_ID;

export const markStartOfNodeLinkPopup = (diagram: Diagram, actions: UndoableAction[]) => {
  diagram.undoManager.setMark(NODE_LINK_POPUP_MARK);
  if (actions.length > 0) {
    diagram.undoManager.add(new CompoundUndoableAction(actions));
  }
};

const combineUndoActionsFromMark = (diagram: Diagram) => {
  const actions: UndoableAction[] = diagram.undoManager.getToMark(NODE_LINK_POPUP_MARK);
  if (actions.length > 0) {
    diagram.undoManager.add(new CompoundUndoableAction(actions));
  }
};

const getEdgeStyles = (diagram: Diagram, options?: NodeLinkOptions): ReadonlyArray<NodeLinkEdgeStyle> => {
  // An explicit list from the source node definition is treated as the exact menu.
  // Entries without an edgeStylesheetId are always kept (name/props-only styles).
  // Entries with an edgeStylesheetId are kept only if the stylesheet exists in the diagram.
  if (options?.edgeStyles !== undefined) {
    return options.edgeStyles.filter(
      s => s.edgeStylesheetId === undefined || diagram.document.styles.getEdgeStyle(s.edgeStylesheetId) !== undefined
    );
  }

  // Edge stylesheet ids from the LRU-style document history.
  const recentIds = diagram.document.props.recentEdgeStylesheets.stylesheets;

  // All edge stylesheet ids currently available in the document.
  const allIds = diagram.document.styles.edgeStyles.map(s => s.id);

  // The currently active edge stylesheet, used as a fallback when history is sparse.
  const activeId = diagram.document.styles.activeEdgeStylesheet.id;

  // Deduped list of all available edge stylesheet ids.
  const availableIds = unique(allIds.filter(Boolean));

  // If the document has only a few edge stylesheets, keep the list exhaustive.
  if (availableIds.length <= EDGE_LIMIT) return availableIds.map(id => ({ id, edgeStylesheetId: id }));

  // Deduped LRU-style candidates, with the active stylesheet appended as a fallback.
  // Otherwise prefer the LRU-style history, with the active stylesheet as a fallback.
  const lruIds = unique([...recentIds.filter(Boolean), activeId].filter(Boolean));
  return unique([...lruIds, ...availableIds]).slice(0, EDGE_LIMIT).map(id => ({ id, edgeStylesheetId: id }));
};

const getNodeStencilIds = (diagram: Diagram, options?: NodeLinkOptions) => {
  // An explicit list from the source node definition is treated as the exact menu.
  // Unknown stencil ids are dropped instead of backfilling from defaults/recents.
  if (options?.stencilIds !== undefined) {
    return options.stencilIds.filter(id => {
      if (id === NO_SHAPE_ID) return true;
      return diagram.document.registry.stencils.getStencil(id) !== undefined;
    });
  }

  const stencilRegistry = diagram.document.registry.stencils;
  const recentIds = diagram.document.props.recentStencils.stencils;

  // All picker-compatible node stencils currently available in the document registry.
  const allIds = stencilRegistry
    .getStencils()
    .flatMap(pkg => getStencilsInPackage(pkg))
    .filter(stencil => isPickerNodeStencil(stencil, diagram))
    .map(stencil => stencil.id);

  // The "basic shapes" subset from the default stencil package, used as the first
  // backfill source when recent history does not fill the popup.
  const basicShapeIds = stencilRegistry
    .get('default')
    .stencils.filter(stencil => isPickerNodeStencil(stencil, diagram))
    .map(stencil => stencil.id);

  // Entries that must always exist in the node picker, regardless of history.
  const pinnedIds = [NO_SHAPE_ID, ...REQUIRED_NODE_STENCIL_IDS];

  // All non-required node stencil ids that can be chosen for the popup.
  const availableIds = unique(
    allIds.filter(Boolean).filter(id => !REQUIRED_NODE_STENCIL_IDS.includes(id))
  );

  // Recently used node stencils that are still available in the registry.
  const recentAvailableIds = recentIds.filter(id => availableIds.includes(id));

  // Basic-shape backfill that is also still available in the registry.
  const basicAvailableIds = basicShapeIds.filter(id => availableIds.includes(id));

  // Keep the required entries first, then prefer recent shapes, then basic shapes,
  // and only then fill remaining slots with any other picker-compatible stencils.
  return unique([...pinnedIds, ...recentAvailableIds, ...basicAvailableIds, ...availableIds]).slice(
    0,
    NODE_LIMIT
  );
};

type NodeLinkPopupPair = {
  nodeStencilId: string;
  edgeStyleId: string;
};

const matchesAllowedCombination = (
  pair: NodeLinkPopupPair,
  combination: NonNullable<NodeLinkOptions['combinations']>[number]
) => {
  return (
    (combination.stencilId === undefined || combination.stencilId === pair.nodeStencilId) &&
    (combination.edgeStyleId === undefined || combination.edgeStyleId === pair.edgeStyleId)
  );
};

const getAllowedCombinations = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStyles: ReadonlyArray<NodeLinkEdgeStyle>,
  options?: NodeLinkOptions
) => {
  // Start from the currently available popup ids only, so stale ids in
  // allowedCombinations cannot reintroduce filtered-out stencil/style entries.
  const pairs = nodeStencilIds.flatMap(nodeStencilId =>
    edgeStyles.map(edgeStyle => ({ nodeStencilId, edgeStyleId: edgeStyle.id }))
  );

  if (options?.combinations === undefined) return pairs;

  return pairs.filter(pair =>
    options.combinations?.some(combination => matchesAllowedCombination(pair, combination))
  );
};

const getVisibleEdgeStyles = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStyles: ReadonlyArray<NodeLinkEdgeStyle>,
  selected: string | undefined,
  options?: NodeLinkOptions
): ReadonlyArray<NodeLinkEdgeStyle> => {
  if (options?.combinations === undefined) return edgeStyles;

  // With combination constraints enabled, the edge column is filtered against the
  // currently selected node. Without a node selection we show every edge style
  // that participates in at least one allowed pair.
  const visibleIds = getAllowedCombinations(nodeStencilIds, edgeStyles, options)
    .filter(pair => selected === undefined || pair.nodeStencilId === selected)
    .map(pair => pair.edgeStyleId);

  return edgeStyles.filter(s => visibleIds.includes(s.id));
};

const getVisibleNodeStencilIds = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStyles: ReadonlyArray<NodeLinkEdgeStyle>,
  selected: string | undefined,
  options?: NodeLinkOptions
) => {
  if (options?.combinations === undefined) return nodeStencilIds;

  // With combination constraints enabled, the node column is filtered against the
  // currently selected edge style. Without an edge selection we show every stencil
  // that participates in at least one allowed pair.
  const visibleIds = getAllowedCombinations(nodeStencilIds, edgeStyles, options)
    .filter(pair => selected === undefined || pair.edgeStyleId === selected)
    .map(pair => pair.nodeStencilId);

  return nodeStencilIds.filter(id => visibleIds.includes(id));
};

const buildStencilPreview = (stencil: Stencil, diagram: Diagram) => {
  const { elements, diagram: dest } = stencil.forPicker(diagram.document.registry);
  assert.arrayWithExactlyOneElement(elements);
  const node = elements[0]! as DiagramNode;

  dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  dest.viewBox.offset = { x: -5, y: -5 };

  UnitOfWork.execute(dest, uow => {
    addStencilStylesToDocument(stencil, dest.document, uow);
    copyStyles(dest, diagram.document, uow);
  });

  return dest;
};

const buildEdgePreview = (stylesheet: EdgeStylesheet, diagram: Diagram) => {
  const { diagram: preview } = createPreview(
    stylesheet.props,
    'edge',
    'rect',
    diagram.document.registry
  );
  return preview;
};

const isPickerNodeStencil = (stencil: Stencil, diagram: Diagram) => {
  try {
    const preview = stencil.forPicker(diagram.document.registry);
    const isSingleNode = preview.elements.length === 1 && isNode(preview.elements[0]);
    preview.diagram.document.release();
    return isSingleNode;
  } catch {
    return false;
  }
};

type CloseMode = 'commit' | 'cancel' | 'idle';

// Owns the live popup interaction state: immediate preview updates, cancel/finalize,
// and the provisional-node lifecycle when switching between a real shape and "no shape".
const useNodeLinkPopupController = ({
  diagram,
  edgeId,
  initialNodeId,
  isOpen,
  position,
  options,
  onClose
}: {
  // Active diagram for all popup-side mutations.
  diagram: Diagram;
  // Edge being configured by the popup.
  edgeId: string;
  // Provisional node id at popup open time, if one already exists.
  initialNodeId: string | undefined;
  // Whether the popup is currently mounted/open.
  isOpen: boolean;
  // Popup anchor position, reused when converting "no shape" into a free edge end.
  position: Point;
  // NodeLinkOptions from the source node definition.
  options?: NodeLinkOptions;
  // Closes the popup surface.
  onClose: () => void;
}) => {
  const hasProvisionalNode = initialNodeId !== undefined;
  const stencilRegistry = diagram.document.registry.stencils;
  const recentStencils = diagram.document.props.recentStencils;
  const recentEdgeStylesheets = diagram.document.props.recentEdgeStylesheets;
  const closeModeRef = useRef<CloseMode>('idle');
  const [selectedEdgeState, setSelectedEdgeState] = useState<string | undefined>(undefined);
  const [selectedNodeState, setSelectedNodeState] = useState<string | undefined>(undefined);
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(initialNodeId);

  const sourceNode = useMemo(() => {
    const edge = diagram.edgeLookup.get(edgeId);
    if (!(edge?.start instanceof ConnectedEndpoint)) return undefined;
    return edge.start.node;
  }, [diagram, edgeId]);
  const nodeDef = sourceNode?.getDefinition();

  const resolvedEdgeStyles = useMemo(() => getEdgeStyles(diagram, options), [diagram, options]);

  const close = useCallback(
    (mode: CloseMode = 'idle') => {
      closeModeRef.current = mode;
      onClose();
    },
    [onClose]
  );

  const setSelectedNode = useCallback(
    (stencilId: string) => {
      setSelectedNodeState(stencilId);

      if (nodeDef?.onNodeLinkSelection) {
        const edge = mustExist(diagram.edgeLookup.get(edgeId));
        const provisionalNode = currentNodeId ? diagram.nodeLookup.get(currentNodeId) : undefined;
        UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
          nodeDef.onNodeLinkSelection!(
            sourceNode!,
            edge,
            provisionalNode,
            stencilId,
            selectedEdgeState,
            options!,
            uow
          );
        });
        return;
      }

      const edge = mustExist(diagram.edgeLookup.get(edgeId));

      if (stencilId === NO_SHAPE_ID) {
        // "No shape" means removing the provisional node and leaving the edge free-standing.
        if (currentNodeId) {
          const node = mustExist(diagram.nodeLookup.get(currentNodeId));
          const diagramPoint = diagram.viewBox.toDiagramPoint(position);

          UnitOfWork.executeWithUndo(diagram, 'Keep edge only', uow => {
            edge.setEnd(new FreeEndpoint(diagramPoint), uow);
            node.layer.removeElement(node, uow);
            uow.select(diagram, [edge]);
          });
          setCurrentNodeId(undefined);
        }
        return;
      }

      const stencil = stencilRegistry.getStencil(stencilId);
      if (!stencil) return;

      let targetNodeId = currentNodeId;
      if (!targetNodeId) {
        if (!(edge.start instanceof ConnectedEndpoint)) return;

        // If the user comes back from "no shape" to a real node shape, recreate the
        // provisional linked node in-place and continue applying shapes to it.
        const recreatedNode = createProvisionalLinkedNode(edge.start.node, edge, edge.end.position);
        setCurrentNodeId(recreatedNode.id);
        targetNodeId = recreatedNode.id;
      }

      if (!targetNodeId) return;

      const node = mustExist(diagram.nodeLookup.get(targetNodeId));
      const layer = node.layer;
      assertRegularLayer(layer);

      UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
        applyStencilToNode(diagram, node, layer, stencil, uow);

        const { bounds: stencilBounds, elements: stencilElements } = stencil.forCanvas(
          diagram.document.registry
        );

        const center = Box.center(node.bounds);
        node.setBounds(
          {
            x: center.x - stencilBounds.w / 2,
            y: center.y - stencilBounds.h / 2,
            w: stencilBounds.w,
            h: stencilBounds.h,
            r: node.bounds.r
          },
          uow
        );

        if (stencilElements.length === 1 && isNode(stencilElements[0])) {
          const stencilNode = stencilElements[0];
          for (const key of Object.keys(node.texts)) {
            if (!(key in stencilNode.texts)) {
              node.setText('', uow, key);
            }
          }
          for (const [key, value] of Object.entries(stencilNode.texts)) {
            node.setText(value, uow, key);
          }
        }
      });

      recentStencils.register(stencil.id);
    },
    [currentNodeId, diagram, edgeId, nodeDef, options, position, recentStencils, selectedEdgeState, sourceNode, stencilRegistry]
  );

  const setSelectedEdge = useCallback(
    (edgeStyleId: string) => {
      setSelectedEdgeState(edgeStyleId);
      const edge = mustExist(diagram.edgeLookup.get(edgeId));

      if (nodeDef?.onNodeLinkSelection) {
        const provisionalNode = currentNodeId ? diagram.nodeLookup.get(currentNodeId) : undefined;
        UnitOfWork.executeWithUndo(diagram, 'Change edge style', uow => {
          nodeDef.onNodeLinkSelection!(
            sourceNode!,
            edge,
            provisionalNode,
            selectedNodeState,
            edgeStyleId,
            options!,
            uow
          );
        });
      } else {
        const edgeStyle = resolvedEdgeStyles.find(s => s.id === edgeStyleId);
        UnitOfWork.executeWithUndo(diagram, 'Change edge style', uow => {
          if (edgeStyle?.edgeStylesheetId) {
            edge.updateMetadata(meta => {
              meta.style = edgeStyle.edgeStylesheetId!;
            }, uow);
          }
          if (edgeStyle?.edgeProps) {
            edge.updateProps(props => {
              deepMerge(props, edgeStyle.edgeProps!);
            }, uow);
          }
        });
      }
    },
    [currentNodeId, diagram, edgeId, nodeDef, options, resolvedEdgeStyles, selectedNodeState, sourceNode]
  );

  const onOk = useCallback(() => {
    if (selectedEdgeState) {
      recentEdgeStylesheets.register(selectedEdgeState);
    }

    // Recent node history only applies when a provisional node still exists.
    if (hasProvisionalNode && selectedNodeState && selectedNodeState !== NO_SHAPE_ID) {
      recentStencils.register(selectedNodeState);
    }

    combineUndoActionsFromMark(diagram);
    close('commit');
  }, [
    close,
    diagram,
    hasProvisionalNode,
    recentEdgeStylesheets,
    recentStencils,
    selectedEdgeState,
    selectedNodeState
  ]);

  const onCancel = useCallback(() => {
    diagram.undoManager.undoToMark(NODE_LINK_POPUP_MARK);
    close('cancel');
  }, [close, diagram]);

  useEffect(() => {
    // Reinitialize the controller state whenever a fresh popup interaction starts.
    if (!isOpen) return;

    closeModeRef.current = 'idle';
    setCurrentNodeId(initialNodeId);
    setSelectedEdgeState(undefined);
    setSelectedNodeState(undefined);
  }, [initialNodeId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedEdgeState !== undefined || selectedNodeState !== undefined) return;
    const def = options?.defaultCombination;
    if (!def) return;
    if (def.edgeStyleId !== undefined) setSelectedEdge(def.edgeStyleId);
    if (def.stencilId !== undefined) setSelectedNode(def.stencilId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return {
    // Apply an edge style immediately and remember the current tile selection.
    setSelectedEdge,
    // Apply a node choice immediately, including "no shape" and node recreation.
    setSelectedNode,
    // Persist the final selections into recents, squash undo history, and close.
    onOk,
    // Undo back to the popup mark and close without committing.
    onCancel,
    // Tracks whether the popup was explicitly committed/cancelled before dismiss.
    closeModeRef,
    // Currently selected edge-style tile.
    selectedEdge: selectedEdgeState,
    // Currently selected node tile.
    selectedNode: selectedNodeState
  };
};

export const NodeLinkPopup = ({ position, isOpen, nodeId, edgeId, options, onClose }: Props) => {
  const diagram = useDiagram();
  const hasProvisionalNode = nodeId !== undefined;
  const stencilRegistry = diagram.document.registry.stencils;
  const styleManager = diagram.document.styles;
  const anchorRef = useRef<HTMLDivElement>(null);
  const redraw = useRedraw();
  const preferredSide =
    typeof window === 'undefined' || position.y <= window.innerHeight / 2 ? 'bottom' : 'top';
  const {
    setSelectedEdge,
    setSelectedNode,
    onOk,
    onCancel,
    closeModeRef,
    selectedEdge,
    selectedNode
  } = useNodeLinkPopupController({
    diagram,
    edgeId,
    initialNodeId: nodeId,
    isOpen,
    position,
    options,
    onClose
  });

  useEventListener(stencilRegistry, 'change', redraw);

  const baseEdgeStyles = useMemo(
    () => getEdgeStyles(diagram, options),
    [diagram, options]
  );

  const baseNodeStencilIds = useMemo(() => {
    if (!hasProvisionalNode) return [];
    return getNodeStencilIds(diagram, options);
  }, [diagram, hasProvisionalNode, options]);

  const visibleEdgeStyles = useMemo(() => {
    return hasProvisionalNode
      ? getVisibleEdgeStyles(
          baseNodeStencilIds,
          baseEdgeStyles,
          selectedNode,
          options
        )
      : baseEdgeStyles;
  }, [
    baseEdgeStyles,
    baseNodeStencilIds,
    hasProvisionalNode,
    options,
    selectedNode
  ]);

  const nodeStencils = useMemo(() => {
    if (!hasProvisionalNode) return [];

    return getVisibleNodeStencilIds(
      baseNodeStencilIds,
      baseEdgeStyles,
      selectedEdge,
      options
    )
      .map(id => {
        if (id === NO_SHAPE_ID) return { id, kind: 'no-shape' as const };

        const stencil = stencilRegistry.getStencil(id);
        if (!stencil) return undefined;
        return { id, kind: 'stencil' as const, stencil };
      })
      .filter(e => e !== undefined);
  }, [
    baseEdgeStyles,
    baseNodeStencilIds,
    hasProvisionalNode,
    options,
    selectedEdge,
    stencilRegistry
  ]);

  const edgePreviewDiagrams = useMemo(
    () =>
      visibleEdgeStyles.flatMap(edgeStyle => {
        if (!edgeStyle.edgeStylesheetId) return [];
        const stylesheet = styleManager.getEdgeStyle(edgeStyle.edgeStylesheetId);
        if (!stylesheet) return [];
        return [{ edgeStyle, stylesheet, diagram: buildEdgePreview(stylesheet, diagram) }];
      }),
    [diagram, styleManager, visibleEdgeStyles]
  );

  const nodePreviewDiagrams = useMemo(
    () =>
      nodeStencils.map(item =>
        item.kind === 'stencil'
          ? { ...item, diagram: buildStencilPreview(item.stencil, diagram) }
          : item
      ),
    [diagram, nodeStencils]
  );

  useEffect(() => {
    return () => {
      edgePreviewDiagrams.forEach(({ diagram }) => diagram.document.release());
      nodePreviewDiagrams.forEach(item => {
        if ('diagram' in item) {
          item.diagram.document.release();
        }
      });
    };
  }, [edgePreviewDiagrams, nodePreviewDiagrams]);

  useEffect(() => {
    if (!isOpen || !hasProvisionalNode) return;

    for (const pkg of stencilRegistry.getStencils()) {
      if (pkg.stencils.length > 0 || (pkg.subPackages?.length ?? 0) > 0) continue;
      void stencilRegistry.loadStencilPackage(pkg.id);
    }
  }, [hasProvisionalNode, isOpen, stencilRegistry]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onOk();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOk, onCancel, isOpen]);

  if (!(diagram.activeLayer instanceof RegularLayer)) return <div></div>;

  return (
    <>
      <div
        ref={anchorRef}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      ></div>
      <Popover.Root
        open={isOpen}
        onOpenChange={s => {
          if (s) return;

          if (closeModeRef.current === 'idle') {
            onCancel();
          }
        }}
      >
        <Popover.Content
          className={`${styles.icNodeLinkPopup} ${
            !hasProvisionalNode ? styles.eEdgeOnlyPopup : ''
          }`}
          sideOffset={5}
          side={preferredSide}
          arrow={false}
          collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }}
          anchor={anchorRef}
        >
          <div className={styles.eColumns}>
            <div className={styles.eSection}>
              <div className={styles.eHeading}>Edges</div>
              <div className={`${objectPickerStyles.icObjectPicker} ${styles.eEdgeGrid}`}>
                {edgePreviewDiagrams.map(({ edgeStyle, stylesheet, diagram: preview }) => (
                  <div
                    key={edgeStyle.id}
                    className={styles.ePickerItem}
                    title={edgeStyle.name ?? stylesheet.name}
                    data-selected={selectedEdge === edgeStyle.id}
                    onClick={() => setSelectedEdge(edgeStyle.id)}
                  >
                    <PickerCanvas
                      name={edgeStyle.name ?? stylesheet.name}
                      size={34}
                      diagram={preview}
                      onMouseDown={() => setSelectedEdge(edgeStyle.id)}
                      showHover={false}
                    />
                  </div>
                ))}
              </div>
            </div>

            {hasProvisionalNode && (
              <div className={styles.eSection}>
                <div className={styles.eHeading}>Nodes</div>
                <div className={`${objectPickerStyles.icObjectPicker} ${styles.eNodeGrid}`}>
                  {nodePreviewDiagrams.map(item =>
                    item.kind === 'no-shape' ? (
                      <div
                        key={item.id}
                        className={styles.ePickerItem}
                        title="No shape"
                        data-selected={selectedNode === item.id}
                        onClick={() => setSelectedNode(item.id)}
                      >
                        <div className={styles.eIconTile}>
                          <LineEndIcon />
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.stencil.id}
                        className={styles.ePickerItem}
                        title={item.stencil.name}
                        data-selected={selectedNode === item.stencil.id}
                        onClick={() => setSelectedNode(item.stencil.id)}
                      >
                        <PickerCanvas
                          name={item.stencil.name}
                          size={34}
                          diagram={item.diagram}
                          onMouseDown={() => setSelectedNode(item.stencil.id)}
                          scaleStrokes={stencilScaleStrokes(item.stencil)}
                          showHover={false}
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles.eFooter}>
            <Button variant={'primary'} onClick={onOk}>
              Ok
            </Button>
            <Button variant={'secondary'} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

NodeLinkPopup.INITIAL_STATE = {
  position: { x: 600, y: 200 },
  isOpen: false,
  nodeId: undefined,
  edgeId: '',
  options: undefined
};

export type NodeLinkPopupState = {
  position: Point;
  isOpen: boolean;
  nodeId: string | undefined;
  edgeId: string;
  options?: NodeLinkOptions;
};

type Props = NodeLinkPopupState & {
  onClose: () => void;
};

export const _test = {
  NO_SHAPE_ID,
  getAllowedCombinations,
  getDefaultEdgeStylesheetIds: (diagram: Diagram) => getEdgeStyles(diagram),
  getEdgeStylesheetIds: getEdgeStyles,
  getNodeStencilIds,
  getVisibleEdgeStylesheetIds: getVisibleEdgeStyles,
  getVisibleNodeStencilIds
};
