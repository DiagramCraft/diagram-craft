import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { StarComponent } from './Star.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';
import { BaseShape, BaseShapeProps } from '../temp/baseShape.temp.ts';

export const Star = (props: Props) => {
  const ref = useComponent<BaseShapeProps, BaseShape>(() => new StarComponent(), {
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
