import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { DiamondComponent } from './Diamond.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';
import { BaseShapeProps } from '../temp/baseShape.temp.ts';

export const Diamond = (props: Props) => {
  const ref = useComponent<BaseShapeProps, DiamondComponent>(() => new DiamondComponent(), {
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
