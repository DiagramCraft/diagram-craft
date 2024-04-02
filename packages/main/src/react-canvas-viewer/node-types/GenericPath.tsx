import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { GenericPathComponent } from './GenericPath.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';

export const GenericPath = (props: Props) => {
  const ref = useComponent(() => new GenericPathComponent(), {
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
