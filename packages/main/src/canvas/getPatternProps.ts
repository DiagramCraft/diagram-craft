import { DeepReadonly, DeepRequired } from '@diagram-craft/utils';
import { Box } from '../geometry/box.ts';

export const getPatternProps = (nodeProps: DeepRequired<DeepReadonly<NodeProps>>, bounds: Box) => {
  if (nodeProps.fill.image && nodeProps.fill.image.url !== '') {
    if (nodeProps.fill.image.fit === 'fill') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'objectBoundingBox',
        imgWith: 1,
        imgHeight: 1,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'keep') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: nodeProps.fill.image.w,
        imgHeight: nodeProps.fill.image.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'contain') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid meet'
      };
    } else if (nodeProps.fill.image.fit === 'cover') {
      return {
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1,
        patternContentUnits: 'userSpaceOnUse',
        imgWith: bounds.w,
        imgHeight: bounds.h,
        preserveAspectRatio: 'xMidYMid slice'
      };
    } else if (nodeProps.fill.image.fit === 'tile') {
      return {
        patternUnits: 'userSpaceOnUse',
        width: Math.max(1, nodeProps.fill.image.w * nodeProps.fill.image.scale),
        height: Math.max(1, nodeProps.fill.image.h * nodeProps.fill.image.scale),
        patternContentUnits: 'userSpaceOnUse',
        imgWith: Math.max(1, nodeProps.fill.image.w * nodeProps.fill.image.scale),
        imgHeight: Math.max(1, nodeProps.fill.image.h * nodeProps.fill.image.scale),
        preserveAspectRatio: 'xMidYMid slice'
      };
    }
  }

  return {
    patternUnits: 'objectBoundingBox',
    width: 1,
    height: 1,
    patternContentUnits: 'objectBoundingBox',
    imgWith: 1,
    imgHeight: 1,
    preserveAspectRatio: 'xMidYMid slice'
  };
};
