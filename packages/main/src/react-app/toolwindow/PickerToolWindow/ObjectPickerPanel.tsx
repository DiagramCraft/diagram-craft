import { PickerCanvas } from '../../PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { Stencil, StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import React, { useEffect, useMemo, useState } from 'react';
import { useApplication, useDiagram } from '../../../application';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from './objectPickerDrag';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ToolWindowPanel, type ToolWindowPanelMode } from '../ToolWindowPanel';
import { PickerConfig } from './pickerConfig';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';

type StencilEntry = {
  stencil: Stencil;
  stencilDiagram: Diagram;
  stencilElements: DiagramElement[];
  canvasElements: DiagramElement[];
};

const STENCIL_CACHE = new Map<string, StencilEntry>();

const makeDiagramNode = (doc: DiagramDocument, n: Stencil): StencilEntry => {
  const cacheKey = n.id;

  if (STENCIL_CACHE.has(cacheKey)) {
    return STENCIL_CACHE.get(cacheKey)!;
  }

  const { elements: stencilElements, diagram: stencilDiagram } = createThumbnail(
    d => n.elementsForPicker(d),
    doc.registry,
    { padding: 5 }
  );

  const { elements: canvasElements } = createThumbnail(d => n.elementsForCanvas(d), doc.registry, {
    padding: 5
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

  const groups = useMemo(() => {
    const res: Array<{
      id: string;
      name: string;
      isDefault: boolean;
      stencils: Array<StencilEntry>;
    }> = [];

    if (!props.isOpen) return res;

    if (props.stencilPackage) {
      if ((props.stencilPackage.subPackages ?? []).length > 1) {
        for (const subPackage of props.stencilPackage.subPackages!) {
          res.push({
            id: subPackage.id,
            name: subPackage.name,
            isDefault: false,
            stencils: subPackage.stencils!.map(n => makeDiagramNode(diagram.document, n))
          });
        }
      } else {
        res.push({
          id: 'default',
          name: '',
          isDefault: true,
          stencils: props.stencilPackage.stencils!.map(n => makeDiagramNode(diagram.document, n))
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

  useEffect(() => {
    if (props.isOpen) {
      setLoaded(true);
    }
  }, [props.isOpen]);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id={props.id}
      title={props.title}
      forceMount={true}
    >
      {loaded && (
        <div className={'cmp-object-picker'}>
          {groups.map(group => (
            <React.Fragment key={group.id}>
              {groups.length > 1 && (
                <div className={'cmp-object-picker__divider'}>
                  <span>{group.name}</span>
                </div>
              )}
              {group.stencils.map(s => (
                <div
                  key={s.stencilDiagram.id}
                  style={{ background: 'transparent' }}
                  data-width={s.stencilDiagram.viewBox.dimensions.w}
                >
                  <PickerCanvas
                    width={PickerConfig.size}
                    height={PickerConfig.size}
                    diagramWidth={s.stencilDiagram.viewBox.dimensions.w}
                    diagramHeight={s.stencilDiagram.viewBox.dimensions.h}
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
                        new ObjectPickerDrag(ev, s.canvasElements, diagram, s.stencil.id, app),
                        () => setShowHover(true)
                      );
                    }}
                    scaleStrokes={s.stencil.type !== 'default' && s.stencil.type !== 'yaml'}
                  />
                </div>
              ))}
            </React.Fragment>
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
