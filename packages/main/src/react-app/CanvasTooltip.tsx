import { useEffect, useRef, useState } from 'react';
import { useDiagram } from '../application';
import { markdownToHTML } from '@diagram-craft/markdown';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import styles from './CanvasTooltip.module.css';

export const CanvasTooltip = () => {
  const diagram = useDiagram();
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentElementIdRef = useRef<string | null>(null);
  const currentMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      // Find the element ID from the SVG element or its parents
      let element: SVGElement | null = e.target as SVGElement;
      let elementId: string | null = null;

      while (element && element !== e.currentTarget) {
        if (element.id?.startsWith('node-')) {
          elementId = element.id.replace(/^node-/, '');
          break;
        } else if (element.id?.startsWith('edge-')) {
          elementId = element.id.replace(/^edge-/, '');
          break;
        }
        element = element.parentElement as SVGElement | null;
      }

      if (elementId && elementId !== currentElementIdRef.current) {
        currentElementIdRef.current = elementId;

        // Clear any existing timer
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
        }

        // Start a new timer for 1 second
        hoverTimerRef.current = setTimeout(() => {
          const diagramElement = diagram.lookup(elementId);
          if (diagramElement?.metadata.tooltip) {
            const htmlContent = markdownToHTML(diagramElement.metadata.tooltip, 'extended');
            setTooltip({
              content: htmlContent,
              x: currentMousePosRef.current.x,
              y: currentMousePosRef.current.y
            });
          }
        }, 1000);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      // Check if we're moving to a child element
      let element: SVGElement | null = e.relatedTarget as SVGElement | null;
      let stillInElement = false;

      while (element) {
        if (element.id?.startsWith('node-') || element.id?.startsWith('edge-')) {
          const id = element.id.replace(/^(node|edge)-/, '');
          if (id === currentElementIdRef.current) {
            stillInElement = true;
            break;
          }
        }
        element = element.parentElement as SVGElement | null;
      }

      if (!stillInElement) {
        currentElementIdRef.current = null;
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        setTooltip(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      currentMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (tooltip) {
        setTooltip(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      }
    };

    const svg = CanvasDomHelper.diagramElement(diagram);
    if (svg) {
      svg.addEventListener('mouseover', handleMouseOver as EventListener);
      svg.addEventListener('mouseout', handleMouseOut as EventListener);
      svg.addEventListener('mousemove', handleMouseMove as EventListener);
    }

    return () => {
      if (svg) {
        svg.removeEventListener('mouseover', handleMouseOver as EventListener);
        svg.removeEventListener('mouseout', handleMouseOut as EventListener);
        svg.removeEventListener('mousemove', handleMouseMove as EventListener);
      }
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, [diagram, tooltip]);

  if (!tooltip) return null;

  return (
    <div
      className={styles.canvasTooltip}
      style={{
        left: `${tooltip.x + 10}px`,
        top: `${tooltip.y + 10}px`
      }}
      dangerouslySetInnerHTML={{ __html: tooltip.content }}
    />
  );
};
