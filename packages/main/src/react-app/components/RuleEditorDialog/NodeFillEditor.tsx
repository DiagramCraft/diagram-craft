import { useConfiguration } from '../../context/ConfigurationContext';
import { elementDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { useDiagram } from '../../../application';
import { FillPanelForm } from '../../toolwindow/ObjectToolWindow/FillPanel';
import { makeProperty } from './utils';

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
    <FillPanelForm
      config={$cfg}
      diagram={diagram}
      color={makeProperty($p, 'fill.color', elementDefaults, onChange)}
      color2={makeProperty($p, 'fill.color2', elementDefaults, onChange)}
      gradientDirection={makeProperty($p, 'fill.gradient.direction', elementDefaults, onChange)}
      gradientType={makeProperty($p, 'fill.gradient.type', elementDefaults, onChange)}
      image={makeProperty($p, 'fill.image.id', elementDefaults, onChange)}
      imageBrightness={makeProperty($p, 'fill.image.brightness', elementDefaults, onChange)}
      imageContrast={makeProperty($p, 'fill.image.contrast', elementDefaults, onChange)}
      imageFit={makeProperty($p, 'fill.image.fit', elementDefaults, onChange)}
      imageH={makeProperty($p, 'fill.image.h', elementDefaults, onChange)}
      imageW={makeProperty($p, 'fill.image.w', elementDefaults, onChange)}
      imageSaturation={makeProperty($p, 'fill.image.saturation', elementDefaults, onChange)}
      imageScale={makeProperty($p, 'fill.image.scale', elementDefaults, onChange)}
      imageTint={makeProperty($p, 'fill.image.tint', elementDefaults, onChange)}
      imageTintStrength={makeProperty($p, 'fill.image.tintStrength', elementDefaults, onChange)}
      pattern={makeProperty($p, 'fill.pattern', elementDefaults, onChange)}
      type={makeProperty($p, 'fill.type', elementDefaults, onChange)}
    />
  );
};
