import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import {
  copyStyles,
  Stencil,
  StencilPackage,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { addStencilStylesToDocument } from '@diagram-craft/model/stencilUtils';
import { useEffect, useMemo, useState } from 'react';
import { useApplication, useDiagram } from '../../../application';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from './objectPickerDrag';
import { createThumbnailFromStencil } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ToolWindowPanel, type ToolWindowPanelMode } from '../ToolWindowPanel';
import { PickerConfig } from './pickerConfig';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import objectPickerStyles from '../../ObjectPicker.module.css';
import styles from './ObjectPickerPanel.module.css';

type StencilEntry = {
  stencil: Stencil;
  stencilDiagram: Diagram;
  stencilElements: DiagramElement[];
  canvasElements: DiagramElement[];
};

const STENCIL_CACHE = new Map<string, StencilEntry>();

type Group = {
  id: string;
  name: string;
  isDefault: boolean;
  stencils: Array<StencilEntry>;
};

const updateStyles = (groups: Array<Group>, diagram: Diagram) => {
  let changes = false;
  for (const group of groups) {
    for (const stencil of group.stencils) {
      UnitOfWork.execute(stencil.stencilDiagram, uow => {
        if (!copyStyles(stencil.stencilDiagram, diagram.document, uow)) {
          uow.abort();
        }
        changes = true;
      });
    }
  }
  return changes;
};

const makeDiagramNode = (doc: DiagramDocument, n: Stencil): StencilEntry => {
  const cacheKey = n.id;

  if (STENCIL_CACHE.has(cacheKey)) {
    return STENCIL_CACHE.get(cacheKey)!;
  }

  const { elements: stencilElements, diagram: stencilDiagram } = createThumbnailFromStencil(
    n.forPicker(doc.registry),
    { padding: 5 }
  );

  UnitOfWork.execute(stencilDiagram, uow => {
    addStencilStylesToDocument(n, stencilDiagram.document, uow);
    copyStyles(stencilDiagram, doc, uow);
  });

  const { elements: canvasElements, diagram: canvasDiagram } = createThumbnailFromStencil(
    n.forCanvas(doc.registry),
    {
      padding: 5
    }
  );

  UnitOfWork.execute(canvasDiagram, uow => {
    addStencilStylesToDocument(n, canvasDiagram.document, uow);
    copyStyles(canvasDiagram, doc, uow);
  });

  const entry: StencilEntry = {
    stencil: n,
    stencilDiagram,
    stencilElements,
    canvasElements
  };
  STENCIL_CACHE.set(cacheKey, entry);

  return entry;
};

export const ObjectPickerPanel = (props: Props) => {
  const diagram = useDiagram();

  const [showHover, setShowHover] = useState(true);
  const app = useApplication();
  const [loaded, setLoaded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const redraw = useRedraw();

  const groups = useMemo(() => {
    const res: Array<Group> = [];

    if (!props.isOpen) return res;

    if (props.stencilPackage) {
      if (props.stencilPackage.stencils.length > 0) {
        res.push({
          id: 'default',
          name: '',
          isDefault: true,
          stencils: props.stencilPackage.stencils.map(n => makeDiagramNode(diagram.document, n))
        });
      }

      for (const subPackage of props.stencilPackage.subPackages ?? []) {
        if (subPackage.stencils.length === 0) continue;

        res.push({
          id: subPackage.id,
          name: subPackage.name,
          isDefault: false,
          stencils: subPackage.stencils.map(n => makeDiagramNode(diagram.document, n))
        });
      }
    } else {
      res.push({
        id: 'default',
        name: '',
        isDefault: true,
        stencils: props.stencils!.map(n => makeDiagramNode(diagram.document, n))
      });
    }

    return res;
  }, [diagram.document, props.stencils, props.stencilPackage, props.isOpen]);

  useEventListener(diagram.document.styles, 'stylesheetUpdated', () => {
    if (updateStyles(groups, diagram)) redraw();
  });

  useEffect(() => {
    if (updateStyles(groups, diagram)) redraw();
  }, [diagram, redraw, groups]);

  useEffect(() => {
    if (props.isOpen) {
      setLoaded(true);
    }
  }, [props.isOpen]);

  useEffect(() => {
    setOpenGroups(current => {
      let changed = false;
      const next = { ...current };

      for (const group of groups) {
        if (group.isDefault || next[group.id] !== undefined) continue;
        next[group.id] = true;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [groups]);

  const renderStencilGrid = (stencils: Array<StencilEntry>) => (
    <div className={objectPickerStyles.icObjectPicker}>
      {stencils.map(s => (
        <div
          key={s.stencilDiagram.id}
          style={{ background: 'transparent' }}
          data-width={s.stencilDiagram.viewBox.dimensions.w}
        >
          <PickerCanvas
            size={PickerConfig.size}
            diagram={s.stencilDiagram}
            showHover={showHover}
            name={
              s.stencil.name ??
              (isNode(s.stencilElements?.[0])
                ? diagram.document.registry.nodes.get(s.stencilElements?.[0].nodeType).name
                : undefined) ??
              'unknown'
            }
            onMouseDown={ev => {
              if (!isRegularLayer(diagram.activeLayer)) return;

              setShowHover(false);
              DRAG_DROP_MANAGER.initiate(
                new ObjectPickerDrag(
                  ev,
                  s.canvasElements,
                  diagram,
                  s.stencil.id,
                  s.stencil.styles ?? [],
                  app,
                  s.stencil.settings?.nodeLinkOptions
                ),
                () => setShowHover(true)
              );
            }}
            scaleStrokes={stencilScaleStrokes(s.stencil)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id={props.id}
      title={props.title}
      forceMount={true}
    >
      {loaded && (
        <div className={styles.icObjectPickerPanel}>
          {groups.map(group => (
            <div key={group.id} className={styles.eGroup}>
              {!group.isDefault ? (
                <div className={styles.eCollapsibleGroup}>
                  <Collapsible
                    label={group.name}
                    open={openGroups[group.id] ?? true}
                    onOpenChange={open => {
                      setOpenGroups(current => ({ ...current, [group.id]: open }));
                    }}
                  >
                    {renderStencilGrid(group.stencils)}
                  </Collapsible>
                </div>
              ) : (
                renderStencilGrid(group.stencils)
              )}
            </div>
          ))}
        </div>
      )}
    </ToolWindowPanel>
  );
};

type Props = {
  id: string;
  title: string;
  stencils?: Stencil[];
  stencilPackage?: StencilPackage;
  isOpen: boolean;
  mode?: ToolWindowPanelMode;
};
