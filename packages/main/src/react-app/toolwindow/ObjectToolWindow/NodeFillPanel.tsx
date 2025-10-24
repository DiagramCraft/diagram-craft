import { useConfiguration } from '../../context/ConfigurationContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useElementProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../../application';
import { FillPanelForm } from './FillPanel';

export const NodeFillPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const redraw = useRedraw();

  const color = useElementProperty($d, 'fill.color');
  const pattern = useElementProperty($d, 'fill.pattern', '');
  const image = useElementProperty($d, 'fill.image.id', '');
  const imageFit = useElementProperty($d, 'fill.image.fit');
  const imageW = useElementProperty($d, 'fill.image.w');
  const imageH = useElementProperty($d, 'fill.image.h');
  const imageScale = useElementProperty($d, 'fill.image.scale');
  const imageTint = useElementProperty($d, 'fill.image.tint');
  const imageTintStrength = useElementProperty($d, 'fill.image.tintStrength');
  const imageBrightness = useElementProperty($d, 'fill.image.brightness');
  const imageContrast = useElementProperty($d, 'fill.image.contrast');
  const imageSaturation = useElementProperty($d, 'fill.image.saturation');
  const color2 = useElementProperty($d, 'fill.color2');
  const type = useElementProperty($d, 'fill.type');
  const enabled = useElementProperty($d, 'fill.enabled');
  const gradientDirection = useElementProperty($d, 'fill.gradient.direction', 0);
  const gradientType = useElementProperty($d, 'fill.gradient.type', 'linear');

  useEventListener($d.selection, 'change', redraw);

  const panelDisabled =
    $d.selection.nodes.every(n => !n.getDefinition().supports('fill')) &&
    $d.selection.edges.every(n => !n.getDefinition().supports('fill'));

  if (panelDisabled) return null;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="fill"
      title={'Fill'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <FillPanelForm
        config={$cfg}
        diagram={$d}
        type={type}
        imageBrightness={imageBrightness}
        imageScale={imageScale}
        imageContrast={imageContrast}
        color={color}
        imageSaturation={imageSaturation}
        color2={color2}
        image={image}
        gradientDirection={gradientDirection}
        gradientType={gradientType}
        imageFit={imageFit}
        imageH={imageH}
        imageTint={imageTint}
        imageTintStrength={imageTintStrength}
        imageW={imageW}
        pattern={pattern}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
