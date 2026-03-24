import { PickerCanvas } from './PickerCanvas';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import type { EdgeStylesheet } from '@diagram-craft/model/diagramStyles';
import { NODE_LINK_POPUP_NO_SHAPE_ID, type NodeLinkOptions } from '@diagram-craft/model/stencilRegistry';
import { ConnectedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { addStencilStylesToDocument, applyStencilToNode } from '@diagram-craft/model/stencilUtils';
import { copyStyles, Stencil, stencilScaleStrokes } from '@diagram-craft/model/stencilRegistry';
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

const getEdgeStylesheetIds = (diagram: Diagram, options?: NodeLinkOptions) => {
  // An explicit list from the source node definition is treated as the exact menu.
  // Unknown stylesheet ids are dropped instead of backfilling from defaults/recents.
  if (options?.edgeStylesheetIds !== undefined) {
    return options.edgeStylesheetIds.filter(
      id => diagram.document.styles.getEdgeStyle(id) !== undefined
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
  if (availableIds.length <= EDGE_LIMIT) return availableIds;

  // Deduped LRU-style candidates, with the active stylesheet appended as a fallback.
  // Otherwise prefer the LRU-style history, with the active stylesheet as a fallback.
  const lruIds = unique([...recentIds.filter(Boolean), activeId].filter(Boolean));
  return unique([...lruIds, ...availableIds]).slice(0, EDGE_LIMIT);
};

const getNodeStencilIds = (diagram: Diagram, options?: NodeLinkOptions) => {
  // An explicit list from the source node definition is treated as the exact menu.
  // Unknown stencil ids are dropped instead of backfilling from defaults/recents.
  if (options?.nodeStencilIds !== undefined) {
    return options.nodeStencilIds.filter(id => {
      if (id === NO_SHAPE_ID) return true;
      return diagram.document.registry.stencils.getStencil(id) !== undefined;
    });
  }

  const stencilRegistry = diagram.document.registry.stencils;
  const recentIds = diagram.document.props.recentStencils.stencils;

  // All picker-compatible node stencils currently available in the document registry.
  const allIds = stencilRegistry
    .getStencils()
    .flatMap(pkg => [...pkg.stencils, ...(pkg.subPackages?.flatMap(sp => sp.stencils) ?? [])])
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
  edgeStylesheetId: string;
};

const matchesAllowedCombination = (
  pair: NodeLinkPopupPair,
  combination: NonNullable<NodeLinkOptions['allowedCombinations']>[number]
) => {
  // Missing fields in the combination act as wildcards for that side.
  return (
    (combination.nodeStencilId === undefined || combination.nodeStencilId === pair.nodeStencilId) &&
    (combination.edgeStylesheetId === undefined ||
      combination.edgeStylesheetId === pair.edgeStylesheetId)
  );
};

const getAllowedCombinations = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStylesheetIds: ReadonlyArray<string>,
  options?: NodeLinkOptions
) => {
  // Start from the currently available popup ids only, so stale ids in
  // allowedCombinations cannot reintroduce filtered-out stencil/style entries.
  const pairs = nodeStencilIds.flatMap(nodeStencilId =>
    edgeStylesheetIds.map(edgeStylesheetId => ({ nodeStencilId, edgeStylesheetId }))
  );

  if (options?.allowedCombinations === undefined) return pairs;

  return pairs.filter(pair =>
    options.allowedCombinations?.some(combination => matchesAllowedCombination(pair, combination))
  );
};

const getVisibleEdgeStylesheetIds = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStylesheetIds: ReadonlyArray<string>,
  selected: string | undefined,
  options?: NodeLinkOptions
) => {
  if (options?.allowedCombinations === undefined) return edgeStylesheetIds;

  // With combination constraints enabled, the edge column is filtered against the
  // currently selected node. Without a node selection we show every edge style
  // that participates in at least one allowed pair.
  const visibleIds = getAllowedCombinations(nodeStencilIds, edgeStylesheetIds, options)
    .filter(pair => selected === undefined || pair.nodeStencilId === selected)
    .map(pair => pair.edgeStylesheetId);

  return edgeStylesheetIds.filter(id => visibleIds.includes(id));
};

const getVisibleNodeStencilIds = (
  nodeStencilIds: ReadonlyArray<string>,
  edgeStylesheetIds: ReadonlyArray<string>,
  selected: string | undefined,
  options?: NodeLinkOptions
) => {
  if (options?.allowedCombinations === undefined) return nodeStencilIds;

  // With combination constraints enabled, the node column is filtered against the
  // currently selected edge style. Without an edge selection we show every stencil
  // that participates in at least one allowed pair.
  const visibleIds = getAllowedCombinations(nodeStencilIds, edgeStylesheetIds, options)
    .filter(pair => selected === undefined || pair.edgeStylesheetId === selected)
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
      });

      recentStencils.register(stencil.id);
    },
    [currentNodeId, diagram, edgeId, position, recentStencils, stencilRegistry]
  );

  const setSelectedEdge = useCallback(
    (stylesheetId: string) => {
      setSelectedEdgeState(stylesheetId);
      const edge = mustExist(diagram.edgeLookup.get(edgeId));

      UnitOfWork.executeWithUndo(diagram, 'Change edge style', uow => {
        edge.updateMetadata(meta => {
          meta.style = stylesheetId;
        }, uow);
      });
    },
    [diagram, edgeId]
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
    onClose
  });

  useEventListener(stencilRegistry, 'change', redraw);

  const baseEdgeStylesheetIds = useMemo(
    () => getEdgeStylesheetIds(diagram, options),
    [diagram, options]
  );

  const baseNodeStencilIds = useMemo(() => {
    if (!hasProvisionalNode) return [];
    return getNodeStencilIds(diagram, options);
  }, [diagram, hasProvisionalNode, options]);

  const edgeStylesheets = useMemo(() => {
    const ids = hasProvisionalNode
      ? getVisibleEdgeStylesheetIds(
          baseNodeStencilIds,
          baseEdgeStylesheetIds,
          selectedNode,
          options
        )
      : baseEdgeStylesheetIds;

    return ids.map(id => styleManager.getEdgeStyle(id)).filter(s => s !== undefined);
  }, [
    baseEdgeStylesheetIds,
    baseNodeStencilIds,
    hasProvisionalNode,
    options,
    selectedNode,
    styleManager
  ]);

  const nodeStencils = useMemo(() => {
    if (!hasProvisionalNode) return [];

    return getVisibleNodeStencilIds(
      baseNodeStencilIds,
      baseEdgeStylesheetIds,
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
    baseEdgeStylesheetIds,
    baseNodeStencilIds,
    hasProvisionalNode,
    options,
    selectedEdge,
    stencilRegistry
  ]);

  const edgePreviewDiagrams = useMemo(
    () =>
      edgeStylesheets.map(stylesheet => ({
        stylesheet,
        diagram: buildEdgePreview(stylesheet, diagram)
      })),
    [diagram, edgeStylesheets]
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
                {edgePreviewDiagrams.map(({ stylesheet, diagram: preview }) => (
                  <div
                    key={stylesheet.id}
                    className={styles.ePickerItem}
                    title={stylesheet.name}
                    data-selected={selectedEdge === stylesheet.id}
                    onClick={() => setSelectedEdge(stylesheet.id)}
                  >
                    <PickerCanvas
                      name={stylesheet.name}
                      size={34}
                      diagram={preview}
                      onMouseDown={() => setSelectedEdge(stylesheet.id)}
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
  getDefaultEdgeStylesheetIds: (diagram: Diagram) => getEdgeStylesheetIds(diagram),
  getEdgeStylesheetIds,
  getNodeStencilIds,
  getVisibleEdgeStylesheetIds,
  getVisibleNodeStencilIds
};
