import { Diagram } from '@diagram-craft/model/diagram';
import { UserState } from '@diagram-craft/main/UserState';
import { useEffect } from 'react';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { Point } from '@diagram-craft/geometry/point';

export const usePanOnDrag = ($d: Diagram, userState: UserState) => {
  useEffect(() => {
    const MAX_PAN_SPEED = 5; // Maximum pixels to pan per frame
    let rafId: number | null = null;
    let isOutsideBounds = false;
    let currentPanAmount = { x: 0, y: 0 };

    const calculatePanAmount = (e: MouseEvent) => {
      const canvas = CanvasDomHelper.diagramElement($d);
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      rect.x += userState.panelLeftWidth;
      rect.width -= userState.panelLeftWidth;
      rect.width -= userState.panelRightWidth;

      const panAmount = { x: 0, y: 0 };

      if (e.x < rect.left) {
        panAmount.x = -(rect.left - e.x);
      } else if (e.x > rect.right) {
        panAmount.x = e.x - rect.right;
      }

      if (e.y < rect.top) {
        panAmount.y = -(rect.top - e.y);
      } else if (e.y > rect.bottom) {
        panAmount.y = e.y - rect.bottom;
      }

      // Cap the pan speed
      const magnitude = Math.sqrt(panAmount.x * panAmount.x + panAmount.y * panAmount.y);
      if (magnitude > MAX_PAN_SPEED) {
        const scale = MAX_PAN_SPEED / magnitude;
        panAmount.x *= scale;
        panAmount.y *= scale;
      }

      panAmount.x *= $d.viewBox.zoomLevel;
      panAmount.y *= $d.viewBox.zoomLevel;

      return panAmount;
    };

    const panLoop = () => {
      if (!isOutsideBounds) return;

      // Pan document
      $d.viewBox.pan(Point.add($d.viewBox.offset, currentPanAmount));

      // Continue the loop
      rafId = requestAnimationFrame(panLoop);
    };

    const callback = (e: MouseEvent) => {
      const drag = DRAG_DROP_MANAGER.current();
      if (drag && !drag.isGlobal) {
        const panAmount = calculatePanAmount(e);

        const wasOutside = isOutsideBounds;
        isOutsideBounds = panAmount.x !== 0 || panAmount.y !== 0;
        currentPanAmount = panAmount;

        // Start the animation loop if we just went outside
        if (isOutsideBounds && !wasOutside) {
          rafId = requestAnimationFrame(panLoop);
        }
        // Stop the animation loop if we just went inside
        else if (!isOutsideBounds && wasOutside && rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        // No drag active, stop panning
        if (isOutsideBounds && rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
          isOutsideBounds = false;
        }
      }
    };

    document.addEventListener('mousemove', callback);
    return () => {
      document.removeEventListener('mousemove', callback);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [$d, userState.panelLeftWidth, userState.panelRightWidth]);
};
