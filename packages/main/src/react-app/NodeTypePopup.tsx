import { PickerCanvas } from './PickerCanvas';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import type { EdgeStylesheet } from '@diagram-craft/model/diagramStyles';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../application';
import { useEventListener } from './hooks/useEventListener';
import { createPreview } from './toolwindow/StyleOverviewToolWindow/stylesPanelUtils';
import styles from './NodeTypePopup.module.css';
import objectPickerStyles from './ObjectPicker.module.css';
import { LineEndIcon } from './icons/LineEndIcon';
import { createProvisionalLinkedNode } from '@diagram-craft/canvas/linkedNode';

const EDGE_LIMIT = 8;
const NODE_LIMIT = 16;
const REQUIRED_NODE_STENCIL_IDS = ['default@@text', 'default@@rect'];

const NODE_LINK_POPUP_MARK = 'node-link-popup';
const NO_SHAPE_ID = '__no_shape__';

export const markStartOfNodeLinkPopup = (
  diagram: Diagram,
  pendingUndoableActions: UndoableAction[]
) => {
  diagram.undoManager.setMark(NODE_LINK_POPUP_MARK);
  if (pendingUndoableActions.length > 0) {
    diagram.undoManager.add(new CompoundUndoableAction(pendingUndoableActions));
  }
};

const combineUndoActionsFromMark = (diagram: Diagram) => {
  const actions: UndoableAction[] = diagram.undoManager.getToMark(NODE_LINK_POPUP_MARK);
  if (actions.length > 0) {
    diagram.undoManager.add(new CompoundUndoableAction(actions));
  }
};

const getRecentEdgeStylesheetIds = (
  recentIds: ReadonlyArray<string>,
  allIds: ReadonlyArray<string>,
  activeId?: string
) => {
  const availableIds = Array.from(new Set(allIds.filter(Boolean)));
  if (availableIds.length <= EDGE_LIMIT) return availableIds;

  const lruIds = Array.from(new Set([...recentIds.filter(Boolean), activeId].filter(Boolean)));
  return Array.from(new Set([...lruIds, ...availableIds])).slice(0, EDGE_LIMIT);
};

const getNodeStencilIds = (
  recentIds: readonly string[],
  allIds: readonly string[],
  basicShapeIds: readonly string[]
) => {
  const pinnedIds = [NO_SHAPE_ID, ...REQUIRED_NODE_STENCIL_IDS];
  const availableIds = Array.from(
    new Set(allIds.filter(Boolean).filter(id => !REQUIRED_NODE_STENCIL_IDS.includes(id)))
  );
  const recentAvailableIds = recentIds.filter(id => availableIds.includes(id));
  const basicAvailableIds = basicShapeIds.filter(id => availableIds.includes(id));

  return Array.from(
    new Set([...pinnedIds, ...recentAvailableIds, ...basicAvailableIds, ...availableIds])
  ).slice(0, NODE_LIMIT);
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

const useNodeTypePopupController = ({
  diagram,
  edgeId,
  initialNodeId,
  isOpen,
  position,
  hasProvisionalNode,
  onClose
}: {
  diagram: Diagram;
  edgeId: string;
  initialNodeId: string | undefined;
  isOpen: boolean;
  position: Point;
  hasProvisionalNode: boolean;
  onClose: () => void;
}) => {
  const stencilRegistry = diagram.document.registry.stencils;
  const recentStencils = diagram.document.props.recentStencils;
  const recentEdgeStylesheets = diagram.document.props.recentEdgeStylesheets;
  const closeModeRef = useRef<CloseMode>('idle');
  const [selectedEdgeStylesheetId, setSelectedEdgeStylesheetId] = useState<string | undefined>(
    undefined
  );
  const [selectedNodeStencilId, setSelectedNodeStencilId] = useState<string | undefined>(undefined);
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(initialNodeId);

  const close = useCallback(
    (mode: CloseMode = 'idle') => {
      closeModeRef.current = mode;
      onClose();
    },
    [onClose]
  );

  const cancelCreation = useCallback(() => {
    diagram.undoManager.undoToMark(NODE_LINK_POPUP_MARK);
    close('cancel');
  }, [close, diagram]);

  const finalizeChange = useCallback(() => {
    combineUndoActionsFromMark(diagram);
    close('commit');
  }, [close, diagram]);

  const applyEdgeStylesheet = useCallback(
    (stylesheetId: string) => {
      const edge = mustExist(diagram.edgeLookup.get(edgeId));

      UnitOfWork.executeWithUndo(diagram, 'Change edge style', uow => {
        edge.updateMetadata(meta => {
          meta.style = stylesheetId;
        }, uow);
      });
    },
    [diagram, edgeId]
  );

  const applyStencil = useCallback(
    (stencil: Stencil, targetNodeId: string) => {
      const node = mustExist(diagram.nodeLookup.get(targetNodeId));
      const layer = node.layer;
      assertRegularLayer(layer);

      UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
        applyStencilToNode(diagram, node, layer, stencil, uow);
      });

      recentStencils.register(stencil.id);
    },
    [diagram, recentStencils]
  );

  const keepOnlyEdge = useCallback(() => {
    const nodeId = mustExist(currentNodeId);
    const node = mustExist(diagram.nodeLookup.get(nodeId));
    const edge = mustExist(diagram.edgeLookup.get(edgeId));
    const diagramPoint = diagram.viewBox.toDiagramPoint(position);

    UnitOfWork.executeWithUndo(diagram, 'Keep edge only', uow => {
      edge.setEnd(new FreeEndpoint(diagramPoint), uow);
      node.layer.removeElement(node, uow);
      uow.select(diagram, [edge]);
    });
    setCurrentNodeId(undefined);
  }, [currentNodeId, diagram, edgeId, position]);

  const recreateProvisionalNode = useCallback(() => {
    const edge = mustExist(diagram.edgeLookup.get(edgeId));
    if (!(edge.start instanceof ConnectedEndpoint)) return undefined;

    const recreatedNode = createProvisionalLinkedNode(edge.start.node, edge, edge.end.position);
    setCurrentNodeId(recreatedNode.id);
    return recreatedNode.id;
  }, [diagram, edgeId]);

  const applyNodeSelection = useCallback(
    (stencilId: string) => {
      setSelectedNodeStencilId(stencilId);

      if (stencilId === NO_SHAPE_ID) {
        if (currentNodeId) {
          keepOnlyEdge();
        }
        return;
      }

      const stencil = stencilRegistry.getStencil(stencilId);
      if (!stencil) return;

      const targetNodeId = currentNodeId ?? recreateProvisionalNode();
      if (!targetNodeId) return;

      applyStencil(stencil, targetNodeId);
    },
    [applyStencil, currentNodeId, keepOnlyEdge, recreateProvisionalNode, stencilRegistry]
  );

  const applyEdgeSelection = useCallback(
    (stylesheetId: string) => {
      setSelectedEdgeStylesheetId(stylesheetId);
      applyEdgeStylesheet(stylesheetId);
    },
    [applyEdgeStylesheet]
  );

  const applySelectionsAndClose = useCallback(() => {
    if (selectedEdgeStylesheetId) {
      recentEdgeStylesheets.register(selectedEdgeStylesheetId);
    }

    if (hasProvisionalNode && selectedNodeStencilId && selectedNodeStencilId !== NO_SHAPE_ID) {
      recentStencils.register(selectedNodeStencilId);
    }

    finalizeChange();
  }, [
    finalizeChange,
    hasProvisionalNode,
    recentEdgeStylesheets,
    recentStencils,
    selectedEdgeStylesheetId,
    selectedNodeStencilId
  ]);

  useEffect(() => {
    if (!isOpen) return;

    closeModeRef.current = 'idle';
    setCurrentNodeId(initialNodeId);
    setSelectedEdgeStylesheetId(undefined);
    setSelectedNodeStencilId(undefined);
  }, [initialNodeId, isOpen]);

  return {
    applyEdgeSelection,
    applyNodeSelection,
    applySelectionsAndClose,
    cancelCreation,
    closeModeRef,
    selectedEdgeStylesheetId,
    selectedNodeStencilId
  };
};

export const NodeTypePopup = ({ position, isOpen, nodeId, edgeId, onClose }: Props) => {
  const diagram = useDiagram();
  const hasProvisionalNode = nodeId !== undefined;
  const stencilRegistry = diagram.document.registry.stencils;
  const styleManager = diagram.document.styles;
  const recentStencils = diagram.document.props.recentStencils;
  const recentEdgeStylesheets = diagram.document.props.recentEdgeStylesheets;
  const anchorRef = useRef<HTMLDivElement>(null);
  const preferredSide =
    typeof window === 'undefined' || position.y <= window.innerHeight / 2 ? 'bottom' : 'top';
  const [stencilRegistryVersion, setStencilRegistryVersion] = useState(0);
  const {
    applyEdgeSelection,
    applyNodeSelection,
    applySelectionsAndClose,
    cancelCreation,
    closeModeRef,
    selectedEdgeStylesheetId,
    selectedNodeStencilId
  } = useNodeTypePopupController({
    diagram,
    edgeId,
    initialNodeId: nodeId,
    isOpen,
    position,
    hasProvisionalNode,
    onClose
  });

  const onStencilRegistryChange = useCallback(() => {
    setStencilRegistryVersion(version => version + 1);
  }, []);

  useEventListener(stencilRegistry, 'change', onStencilRegistryChange);

  const edgeStylesheets = useMemo(() => {
    const ids = getRecentEdgeStylesheetIds(
      diagram.document.props.recentEdgeStylesheets.stylesheets,
      styleManager.edgeStyles.map(s => s.id),
      styleManager.activeEdgeStylesheet.id
    );

    return ids
      .map(id => styleManager.getEdgeStyle(id))
      .filter((stylesheet): stylesheet is EdgeStylesheet => stylesheet !== undefined);
  }, [
    recentEdgeStylesheets,
    styleManager,
    styleManager.activeEdgeStylesheet.id,
    styleManager.edgeStyles
  ]);

  const nodeStencils = useMemo(() => {
    if (!hasProvisionalNode) return [];

    const allStencils = stencilRegistry
      .getStencils()
      .flatMap(pkg => [...pkg.stencils, ...(pkg.subPackages?.flatMap(sp => sp.stencils) ?? [])])
      .filter(stencil => isPickerNodeStencil(stencil, diagram));
    const basicShapeStencilIds = stencilRegistry
      .get('default')
      .stencils.filter(stencil => isPickerNodeStencil(stencil, diagram))
      .map(stencil => stencil.id);
    const stencilIds = getNodeStencilIds(
      recentStencils.stencils,
      allStencils.map(stencil => stencil.id),
      basicShapeStencilIds
    );
    return stencilIds
      .map(id => {
        if (id === NO_SHAPE_ID) {
          return { id, kind: 'no-shape' as const };
        }

        const stencil = stencilRegistry.getStencil(id);
        if (!stencil) return undefined;
        return { id, kind: 'stencil' as const, stencil };
      })
      .filter(
        (
          e
        ): e is
          | { id: string; kind: 'no-shape' }
          | { id: string; kind: 'stencil'; stencil: Stencil } => e !== undefined
      );
  }, [diagram, hasProvisionalNode, recentStencils, stencilRegistry, stencilRegistryVersion]);

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
        applySelectionsAndClose();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelCreation();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applySelectionsAndClose, cancelCreation, isOpen]);

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
            cancelCreation();
          }
        }}
      >
        <Popover.Content
          className={`${styles.icNodeTypePopup} ${
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
                    tabIndex={0}
                    className={styles.ePickerItem}
                    title={stylesheet.name}
                    data-selected={selectedEdgeStylesheetId === stylesheet.id}
                    onClick={() => applyEdgeSelection(stylesheet.id)}
                  >
                    <PickerCanvas
                      name={stylesheet.name}
                      size={34}
                      diagram={preview}
                      onMouseDown={() => applyEdgeSelection(stylesheet.id)}
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
                        data-selected={selectedNodeStencilId === item.id}
                        onClick={() => applyNodeSelection(item.id)}
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
                        data-selected={selectedNodeStencilId === item.stencil.id}
                        onClick={() => applyNodeSelection(item.stencil.id)}
                      >
                        <PickerCanvas
                          name={item.stencil.name}
                          size={34}
                          diagram={item.diagram}
                          onMouseDown={() => applyNodeSelection(item.stencil.id)}
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
            <Button variant={'primary'} onClick={applySelectionsAndClose}>
              Ok
            </Button>
            <Button variant={'secondary'} onClick={cancelCreation}>
              Cancel
            </Button>
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

NodeTypePopup.INITIAL_STATE = {
  position: { x: 600, y: 200 },
  isOpen: false,
  nodeId: undefined,
  edgeId: ''
};

export type NodeTypePopupState = {
  position: Point;
  isOpen: boolean;
  nodeId: string | undefined;
  edgeId: string;
};

type Props = NodeTypePopupState & {
  onClose: () => void;
};

export const _test = {
  NO_SHAPE_ID,
  getRecentEdgeStylesheetIds,
  getNodeStencilIds
};
