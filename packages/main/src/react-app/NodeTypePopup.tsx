import { PickerCanvas } from './PickerCanvas';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from '@diagram-craft/model/diagram';
import type { EdgeStylesheet } from '@diagram-craft/model/diagramStyles';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  addStencilStylesToDocument,
  applyStencilToNode
} from '@diagram-craft/model/stencilUtils';
import {
  copyStyles,
  Stencil,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { CompoundUndoableAction, type UndoableAction } from '@diagram-craft/model/undoManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../application';
import { createPreview } from './toolwindow/StyleOverviewToolWindow/stylesPanelUtils';
import {
  getRecentEdgeStylesheetIds,
  getRecentNodeStencilIds,
  NO_SHAPE_ID
} from './NodeTypePopup.utils';
import styles from './NodeTypePopup.module.css';
import { LineEndIcon } from './icons/LineEndIcon';

const combineUndoActionsFromDepth = (diagram: Diagram, undoDepth: number) => {
  const actions: UndoableAction[] = [];
  while (diagram.undoManager.undoableActions.length > undoDepth) {
    actions.unshift(diagram.undoManager.undoableActions.pop()!);
  }
  if (actions.length > 0) {
    diagram.undoManager.add(new CompoundUndoableAction(actions));
  }
};

const undoToDepth = (diagram: Diagram, undoDepth: number) => {
  while (diagram.undoManager.undoableActions.length > undoDepth) {
    diagram.undoManager.undo();
  }
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

export const NodeTypePopup = ({
  position,
  isOpen,
  nodeId,
  edgeId,
  mode,
  undoDepth,
  onClose
}: Props) => {
  const diagram = useDiagram();
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeModeRef = useRef<'idle' | 'commit' | 'cancel'>('idle');
  const preferredSide =
    typeof window === 'undefined' || position.y <= window.innerHeight / 2 ? 'bottom' : 'top';
  const [selectedEdgeStylesheetId, setSelectedEdgeStylesheetId] = useState<string | undefined>(
    undefined
  );
  const [selectedNodeStencilId, setSelectedNodeStencilId] = useState<string | undefined>(undefined);

  const close = useCallback(
    (mode: 'commit' | 'cancel' | 'idle' = 'idle') => {
      closeModeRef.current = mode;
      onClose();
    },
    [onClose]
  );

  const cancelCreation = useCallback(() => {
    undoToDepth(diagram, undoDepth);
    close('cancel');
  }, [close, diagram, undoDepth]);

  const finalizeChange = useCallback(() => {
    combineUndoActionsFromDepth(diagram, undoDepth);
    close('commit');
  }, [close, diagram, undoDepth]);

  const applyEdgeStylesheet = useCallback(
    (stylesheetId: string) => {
      const edge = mustExist(diagram.edgeLookup.get(edgeId));

      UnitOfWork.executeWithUndo(diagram, 'Change edge style', uow => {
        edge.updateMetadata(meta => {
          meta.style = stylesheetId;
        }, uow);
      });

      diagram.document.props.recentEdgeStylesheets.register(stylesheetId);
    },
    [diagram, edgeId]
  );

  const applyStencil = useCallback(
    (stencil: Stencil) => {
      const node = mustExist(diagram.nodeLookup.get(nodeId));
      const layer = node.layer;
      assertRegularLayer(layer);

      UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
        applyStencilToNode(diagram, node, layer, stencil, uow);
      });

      diagram.document.props.recentStencils.register(stencil.id);
    },
    [diagram, nodeId]
  );

  const keepOnlyEdge = useCallback(() => {
    const node = mustExist(diagram.nodeLookup.get(nodeId));
    const edge = mustExist(diagram.edgeLookup.get(edgeId));
    const diagramPoint = diagram.viewBox.toDiagramPoint(position);

    UnitOfWork.executeWithUndo(diagram, 'Keep edge only', uow => {
      edge.setEnd(new FreeEndpoint(diagramPoint), uow);
      node.layer.removeElement(node, uow);
      uow.select(diagram, [edge]);
    });
  }, [diagram, edgeId, nodeId, position]);

  const applySelectionsAndClose = useCallback(() => {
    if (selectedEdgeStylesheetId) {
      applyEdgeStylesheet(selectedEdgeStylesheetId);
    }

    if (mode === 'mixed' && selectedNodeStencilId) {
      if (selectedNodeStencilId === NO_SHAPE_ID) {
        keepOnlyEdge();
      } else {
        const stencil = diagram.document.registry.stencils.getStencil(selectedNodeStencilId);
        if (stencil) {
          applyStencil(stencil);
        }
      }
    }

    finalizeChange();
  }, [
    applyEdgeStylesheet,
    applyStencil,
    diagram.document.registry.stencils,
    finalizeChange,
    keepOnlyEdge,
    mode,
    selectedEdgeStylesheetId,
    selectedNodeStencilId
  ]);

  const edgeStylesheets = useMemo(() => {
    const ids = getRecentEdgeStylesheetIds(
      diagram.document.props.recentEdgeStylesheets.stylesheets,
      diagram.document.styles.edgeStyles.map(s => s.id),
      diagram.document.styles.activeEdgeStylesheet.id
    );

    return ids
      .map(id => diagram.document.styles.getEdgeStyle(id))
      .filter((stylesheet): stylesheet is EdgeStylesheet => stylesheet !== undefined);
  }, [diagram]);

  const nodeStencils = useMemo(() => {
    if (mode === 'edges-only') return [];

    const stencilIds = getRecentNodeStencilIds(diagram.document.props.recentStencils.stencils);
    return stencilIds
      .map(id => {
        if (id === NO_SHAPE_ID) {
          return { id, kind: 'no-shape' as const };
        }

        const stencil = diagram.document.registry.stencils.getStencil(id);
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
  }, [diagram, mode]);

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
        item.kind === 'stencil' ? { ...item, diagram: buildStencilPreview(item.stencil, diagram) } : item
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
    if (!isOpen) return;

    closeModeRef.current = 'idle';
  }, [isOpen]);

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
            mode === 'edges-only' ? styles.eEdgeOnlyPopup : ''
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
              <div className={styles.eEdgeGrid}>
                {edgePreviewDiagrams.map(({ stylesheet, diagram: preview }) => (
                  <button
                    key={stylesheet.id}
                    type="button"
                    className={styles.ePickerItem}
                    title={stylesheet.name}
                    data-selected={selectedEdgeStylesheetId === stylesheet.id}
                    onClick={() => setSelectedEdgeStylesheetId(stylesheet.id)}
                  >
                    <PickerCanvas
                      name={stylesheet.name}
                      size={34}
                      diagram={preview}
                      onMouseDown={() => setSelectedEdgeStylesheetId(stylesheet.id)}
                      showHover={false}
                    />
                  </button>
                ))}
              </div>
            </div>

            {mode === 'mixed' && (
              <div className={styles.eSection}>
                <div className={styles.eHeading}>Nodes</div>
                <div className={styles.eNodeGrid}>
                  {nodePreviewDiagrams.map(item =>
                    item.kind === 'no-shape' ? (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.ePickerItem}
                        title="No shape"
                        data-selected={selectedNodeStencilId === item.id}
                        onClick={() => setSelectedNodeStencilId(item.id)}
                      >
                        <div className={styles.eIconTile}>
                          <LineEndIcon />
                        </div>
                      </button>
                    ) : (
                      <button
                        key={item.stencil.id}
                        type="button"
                        className={styles.ePickerItem}
                        title={item.stencil.name}
                        data-selected={selectedNodeStencilId === item.stencil.id}
                        onClick={() => setSelectedNodeStencilId(item.stencil.id)}
                      >
                        <PickerCanvas
                          name={item.stencil.name}
                          size={34}
                          diagram={item.diagram}
                          onMouseDown={() => setSelectedNodeStencilId(item.stencil.id)}
                          scaleStrokes={stencilScaleStrokes(item.stencil)}
                          showHover={false}
                        />
                      </button>
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
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

NodeTypePopup.INITIAL_STATE = {
  position: { x: 600, y: 200 },
  isOpen: false,
  nodeId: '',
  edgeId: '',
  mode: 'mixed' as const,
  undoDepth: 0
};

export type NodeTypePopupState = {
  position: Point;
  isOpen: boolean;
  nodeId: string;
  edgeId: string;
  mode: 'mixed' | 'edges-only';
  undoDepth: number;
};

type Props = NodeTypePopupState & {
  onClose: () => void;
};
