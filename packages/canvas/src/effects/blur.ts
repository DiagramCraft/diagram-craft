import * as svg from '../component/vdom-svg';

export const makeBlur = (blur: number) => {
  return svg.feGaussianBlur({ stdDeviation: 5 * blur });
};
