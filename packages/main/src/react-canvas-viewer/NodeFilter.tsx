import { DeepReadonly, DeepRequired } from '../utils/types.ts';

export const NodeFilter = (props: Props) => (
  <filter id={props.id} filterUnits={'objectBoundingBox'}>
    {props.nodeProps.effects.blur && (
      <feGaussianBlur stdDeviation={5 * props.nodeProps.effects.blur} />
    )}
    {props.nodeProps.effects.opacity !== 1 && (
      <feColorMatrix
        type="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${props.nodeProps.effects.opacity} 0`}
      />
    )}
  </filter>
);

type Props = { id: string; nodeProps: DeepRequired<DeepReadonly<NodeProps>> };
