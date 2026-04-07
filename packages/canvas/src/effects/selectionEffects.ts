import type { Box } from '@diagram-craft/geometry/box';
import type { Selection } from '@diagram-craft/model/selection';
import {
  compensateIsometricResizeBounds,
  hasMatchingIsometricProjection,
  makeIsometricTransform
} from './isometric';
import type { ResizeType } from '../drag/resizeDrag';

export type SelectionProjection = {
  transform: (bounds: Box) => string;
};

export type ResizeCompensation = {
  compensate: (before: Box, after: Box, type: ResizeType) => Box;
};

type SelectionProjectionProvider = (selection: Selection) => SelectionProjection | undefined;
type ResizeCompensationProvider = (selection: Selection) => ResizeCompensation | undefined;

const selectionProjectionProviders: SelectionProjectionProvider[] = [
  selection => {
    const nonLabelNodes = selection.nodes.filter(n => !n.labelEdge());
    if (nonLabelNodes.length === 0) return undefined;

    const ref = nonLabelNodes[0]!.renderProps;
    if (!nonLabelNodes.every(node => hasMatchingIsometricProjection(ref, node.renderProps))) {
      return undefined;
    }

    return {
      transform: bounds => makeIsometricTransform(bounds, ref).svgForward()
    };
  }
];

const resizeCompensationProviders: ResizeCompensationProvider[] = [
  selection => {
    if (selection.type !== 'single-node') return undefined;

    const node = selection.nodes[0]!;
    if (!node.renderProps.effects.isometric.enabled) return undefined;

    return {
      compensate: (before, after, type) =>
        compensateIsometricResizeBounds(before, after, type, node.renderProps)
    };
  }
];

export const resolveSelectionProjection = (selection: Selection) => {
  return selectionProjectionProviders.find(provider => provider(selection) !== undefined)?.(
    selection
  );
};

export const resolveResizeCompensation = (selection: Selection) => {
  return resizeCompensationProviders.find(provider => provider(selection) !== undefined)?.(
    selection
  );
};
