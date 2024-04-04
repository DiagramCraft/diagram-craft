import { ReactNodeProps } from '../reactNodeDefinition.ts';
import { GenericPathComponent } from './GenericPath.nodeType.ts';
import { useComponent } from '../temp/useComponent.temp.ts';
import { BaseShapeProps } from '../temp/baseShape.temp.ts';

export const GenericPath = (props: Props) => {
  const ref = useComponent<BaseShapeProps, GenericPathComponent>(() => new GenericPathComponent(), {
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
