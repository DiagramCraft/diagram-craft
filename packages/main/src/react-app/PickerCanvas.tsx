import { Canvas } from '@diagram-craft/canvas-react/Canvas';
import { Diagram } from '@diagram-craft/model/diagram';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Point } from '@diagram-craft/geometry/point';
import { useApplication, useDiagram } from '../application';
import {
  StaticCanvasComponent,
  StaticCanvasProps
} from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { createPortal } from 'react-dom';
import styles from './PickerCanvas.module.css';
import {
  serializeDiagram,
  serializeDiagramDocument
} from '@diagram-craft/model/serialization/serialize';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { makeDefaultDiagramFactory } from '@diagram-craft/model/diagramDocumentFactory';

const canvasFactory = () => new StaticCanvasComponent();

export const PickerCanvas = (props: PickerCanvasProps) => {
  const application = useApplication();
  const $d = useDiagram();
  const diagram = props.diagram;
  const timeout = useRef<number | null>(null);
  const [hover, setHover] = useState<Point | undefined>(undefined);
  const r = useRef<string>('');
  const [preview, setPreview] = useState<DiagramDocument | undefined>(undefined);

  useEffect(() => {
    if (preview) setPreview(undefined);
  }, [diagram]);

  const getPreviewDiagram = async () => {
    const s = await serializeDiagramDocument(diagram.document);
    s.diagrams = [serializeDiagram(diagram)];
    s.diagrams[0]!.id = newid();

    const doc = new DiagramDocument(diagram.document.registry, true);
    await deserializeDiagramDocument(s, doc, makeDefaultDiagramFactory());
    return doc;
  };

  const onMouseOver = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: rect.x, y: rect.y };

    // Note: this is a hack to ensure the event is not re-triggered as the object is dropped on the canvas
    const hash = `${e.nativeEvent.screenX},${e.nativeEvent.screenY},${e.nativeEvent.offsetX},${e.nativeEvent.offsetY}`;
    if (r.current === hash) return;
    r.current = hash;

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = window.setTimeout(() => {
      setHover(p);
    }, 100);
  };

  const onMouseOut = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    setHover(undefined);
  }, []);

  if (!props.showHover && hover) {
    setHover(undefined);
  }

  if (hover && props.showHover && preview === undefined) {
    getPreviewDiagram().then(doc => setPreview(doc));
  }

  // TODO: We should use default cursor instead of move cursor when disabled
  const isRuleLayer = $d.activeLayer.type === 'rule';
  return (
    <div
      onMouseOver={isRuleLayer ? () => {} : e => onMouseOver(e)}
      onMouseLeave={isRuleLayer ? () => {} : onMouseOut}
      style={{
        'filter': isRuleLayer ? 'opacity(0.3)' : 'none',
        // @ts-expect-error valid use
        '--container-outline': '#d5d5d4'
      }}
      className={props.scaleStrokes === undefined || props.scaleStrokes ? 'scale-strokes' : ''}
      onPointerDown={isRuleLayer ? () => {} : e => props.onMouseDown?.(e.nativeEvent) ?? (() => {})}
    >
      {hover &&
        props.showHover &&
        preview !== undefined &&
        createPortal(
          <div className={styles.pickerCanvasPreview} style={{ left: hover.x + 40, top: hover.y }}>
            <Canvas<StaticCanvasComponent, StaticCanvasProps>
              id={`picker-canvas-portal-${props.diagram.id}`}
              context={application}
              width={80}
              height={80}
              onClick={() => {}}
              diagram={preview.diagrams[0]!}
              viewbox={props.diagram.viewBox.svgViewboxString}
              canvasFactory={canvasFactory}
            />

            <div
              style={{
                lineHeight: '14px',
                justifySelf: 'flex-end',
                marginTop: 'auto',
                textAlign: 'center'
              }}
            >
              {props.name}
            </div>
          </div>,
          document.body
        )}

      <Canvas<StaticCanvasComponent, StaticCanvasProps>
        id={`picker-canvas-${props.diagram.id}`}
        context={application}
        width={props.size ?? 40}
        height={props.size ?? 40}
        diagram={diagram}
        className={`canvas ${styles.pickerCanvas}`}
        viewbox={`${props.diagram.viewBox.svgViewboxString}`}
        canvasFactory={canvasFactory}
      />
    </div>
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
  size?: number;
  showHover?: boolean;
  name?: string;
  onMouseDown?: (e: MouseEvent) => void;
  scaleStrokes?: boolean;
};
