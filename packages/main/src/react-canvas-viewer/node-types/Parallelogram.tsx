import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { ParallelogramComponent } from './Parallelogram.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';

export const Parallelogram = (props: Props) => {
  const ref = useComponent(() => new ParallelogramComponent(), {
    // @ts-ignore
    style: props.style!,
    node: props.node,
    onMouseDown: props.onMouseDown!,
    nodeProps: props.nodeProps,
    isSingleSelected: props.isSingleSelected,
    tool: props.tool
  });

  return <g ref={ref} />;
};

type Props = ReactNodeProps;
