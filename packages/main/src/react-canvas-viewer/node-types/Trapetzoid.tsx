import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { TrapetzoidComponent } from './Trapetzoid.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';

export const Trapetzoid = (props: Props) => {
  const ref = useComponent(() => new TrapetzoidComponent(), {
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
