import { useConfiguration } from '../../context/ConfigurationContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useElementProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../../application';
import { FillPanelForm } from './FillPanel';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { EdgeFlags } from '@diagram-craft/model/edgeDefinition';
import { range, unique } from '@diagram-craft/utils/array';
import { makePropertyFromArray } from '@diagram-craft/model/property';
import { $t } from '@diagram-craft/utils/localize';

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
    $d.selection.nodes.every(n => !n.getDefinition().hasFlag(NodeFlags.StyleFill)) &&
    $d.selection.edges.every(n => !n.getDefinition().hasFlag(EdgeFlags.StyleFill));

  if (panelDisabled) return null;

  const nodeFillCounts = unique($d.selection.nodes.map(e => e.getDefinition().additionalFillCount));
  const additionalFillCount =
    ($d.selection.type === 'single-node' || $d.selection.type === 'nodes') &&
    nodeFillCounts.length === 1
      ? nodeFillCounts[0]!
      : 0;

  const additionalFills =
    additionalFillCount === 0
      ? []
      : range(0, additionalFillCount).map(idx => ({
          color: makePropertyFromArray(
            'Update fill colors',
            $d.selection.nodes,
            n => n.renderProps,
            n => n.editProps,
            n => n.getPropsInfo(`additionalFills.${idx}.color`, ''),
            (n, v, uow) =>
              n.updateProps(props => {
                props.additionalFills ??= {};
                props.additionalFills[idx] ??= {};
                props.additionalFills[idx].color = v;
              }, uow),
            $d,
            `additionalFills.${idx}.color`,
            ''
          ),
          enabled: makePropertyFromArray(
            'Update fill colors',
            $d.selection.nodes,
            n => n.renderProps,
            n => n.editProps,
            n => n.getPropsInfo(`additionalFills.${idx}.enabled`, false),
            (n, v, uow) =>
              n.updateProps(props => {
                props.additionalFills ??= {};
                props.additionalFills[idx] ??= {};
                props.additionalFills[idx].enabled = v;
              }, uow),
            $d,
            `additionalFills.${idx}.enabled`,
            false
          )
        }));

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="fill"
      title={$t('panel.fill', 'Fill')}
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
        additionalFills={additionalFills}
        pattern={pattern}
        palette={unique(
          $d.selection.nodes.flatMap(
            n => $d.document.styles.getNodeStyle(n.metadata.style)?.fillColors ?? []
          )
        )}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
