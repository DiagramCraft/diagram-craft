import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { CircleComponent } from './Circle.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';

declare global {
  interface NodeProps {}
}

export const Circle = (props: Props) => {
  const ref = useComponent(() => new CircleComponent(), {
    // @ts-ignore
    style: props.style!,
    node: props.node,
    // @ts-ignore
    onMouseDown: props.onMouseDown!,
    nodeProps: props.nodeProps,
    isSingleSelected: props.isSingleSelected,
    tool: props.tool
  });

  return <g ref={ref} />;
};

type Props = ReactNodeProps;
