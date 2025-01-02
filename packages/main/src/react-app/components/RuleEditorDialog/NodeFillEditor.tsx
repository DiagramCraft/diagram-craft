import { useConfiguration } from '../../context/ConfigurationContext';
import { NodeFillPanelForm } from '../../toolwindow/ObjectToolWindow/NodeFillPanel';
import { elementDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { useDiagram } from '../../../application';

export const NodeFillEditor: Editor = props => {
  const $p = props.props;
  $p.fill ??= {};
  $p.fill.enabled = true;

  const $cfg = useConfiguration();
  const diagram = useDiagram();

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeFillPanelForm
      config={$cfg}
      diagram={diagram}
      color={makeProperty($p, 'fill.color', elementDefaults2, onChange)}
      color2={makeProperty($p, 'fill.color2', elementDefaults2, onChange)}
      gradientDirection={makeProperty($p, 'fill.gradient.direction', elementDefaults2, onChange)}
      gradientType={makeProperty($p, 'fill.gradient.type', elementDefaults2, onChange)}
      image={makeProperty($p, 'fill.image.id', elementDefaults2, onChange)}
      imageBrightness={makeProperty($p, 'fill.image.brightness', elementDefaults2, onChange)}
      imageContrast={makeProperty($p, 'fill.image.contrast', elementDefaults2, onChange)}
      imageFit={makeProperty($p, 'fill.image.fit', elementDefaults2, onChange)}
      imageH={makeProperty($p, 'fill.image.h', elementDefaults2, onChange)}
      imageW={makeProperty($p, 'fill.image.w', elementDefaults2, onChange)}
      imageSaturation={makeProperty($p, 'fill.image.saturation', elementDefaults2, onChange)}
      imageScale={makeProperty($p, 'fill.image.scale', elementDefaults2, onChange)}
      imageTint={makeProperty($p, 'fill.image.tint', elementDefaults2, onChange)}
      imageTintStrength={makeProperty($p, 'fill.image.tintStrength', elementDefaults2, onChange)}
      pattern={makeProperty($p, 'fill.pattern', elementDefaults2, onChange)}
      type={makeProperty($p, 'fill.type', elementDefaults2, onChange)}
    />
  );
};
