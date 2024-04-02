import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { RoundedRectComponent } from './RoundedRect.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';

export const RoundedRect = (props: Props) => {
  const ref = useComponent(() => new RoundedRectComponent(), {
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
