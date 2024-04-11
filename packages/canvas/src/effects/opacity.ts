import * as svg from '../component/vdom-svg';

export const makeOpacity = (opacity: number) => {
  return svg.feColorMatrix({
    type: 'matrix',
    values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${opacity} 0`
  });
};
