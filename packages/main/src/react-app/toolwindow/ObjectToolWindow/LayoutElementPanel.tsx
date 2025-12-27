import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useNodeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { isNode } from '@diagram-craft/model/diagramElement';

export const LayoutElementPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const widthMin = useNodeProperty(diagram, 'layout.element.width.min');
  const widthMax = useNodeProperty(diagram, 'layout.element.width.max');
  const heightMin = useNodeProperty(diagram, 'layout.element.height.min');
  const heightMax = useNodeProperty(diagram, 'layout.element.height.max');
  const preserveAspectRatio = useNodeProperty(diagram, 'layout.element.preserveAspectRatio', false);
  const grow = useNodeProperty(diagram, 'layout.element.grow', 0);
  const shrink = useNodeProperty(diagram, 'layout.element.shrink', 0);
  const isAbsolute = useNodeProperty(diagram, 'layout.element.isAbsolute', false);

  useEventListener(diagram.selection, 'change', redraw);

  // Check visibility conditions
  const elements = diagram.selection.elements;

  if (elements.length === 0) return null;

  // Check all are nodes (layout properties only exist on nodes)
  const allAreNodes = elements.every(e => isNode(e));
  if (!allAreNodes) return null;

  // Check all have parents
  const firstElement = elements[0];
  if (!firstElement || !firstElement.parent) return null;

  const allHaveParents = elements.every(e => e.parent !== undefined);
  if (!allHaveParents) return null;

  // Check all have same parent
  const firstParent = firstElement.parent;
  const allSameParent = elements.every(e => e.parent === firstParent);
  if (!allSameParent) return null;

  // Check parent is a node and supports layout
  const parentIsNode = isNode(firstParent);
  if (!parentIsNode) return null;

  const parentSupportsLayout = firstParent.getDefinition().supports('can-have-layout');
  if (!parentSupportsLayout) return null;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="layout-element"
      title={'Layout Properties'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Width</div>
        <div className={'cmp-labeled-table__value'}>
          <div className={'util-hstack'}>
            <NumberInput
              value={widthMin.val}
              onChange={widthMin.set}
              defaultUnit="px"
              min={0}
              placeholder="0"
              style={{ width: '76px' }}
            />
            <div>-</div>
            <NumberInput
              value={widthMax.val}
              onChange={widthMax.set}
              defaultUnit="px"
              min={0}
              placeholder="∞"
              style={{ width: '76px' }}
            />
          </div>
        </div>

        <div className={'cmp-labeled-table__label'}>Height</div>
        <div className={'cmp-labeled-table__value'}>
          <div className={'util-hstack'}>
            <NumberInput
              value={heightMin.val}
              onChange={heightMin.set}
              defaultUnit="px"
              min={0}
              placeholder="0"
              style={{ width: '76px' }}
            />
            <div>-</div>
            <NumberInput
              value={heightMax.val}
              onChange={heightMax.set}
              defaultUnit="px"
              min={0}
              placeholder="∞"
              style={{ width: '76px' }}
            />
          </div>
        </div>

        <div className={'cmp-labeled-table__label'}>Aspect Ratio</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox value={preserveAspectRatio.val} onChange={preserveAspectRatio.set} />
        </div>

        <div className={'cmp-labeled-table__label'}>Absolute</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox value={isAbsolute.val} onChange={isAbsolute.set} />
        </div>

        <div className={'cmp-labeled-table__label'}>Grow</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={grow.val}
            onChange={grow.set}
            min={0}
            step={1}
            style={{ width: '60px' }}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Shrink</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={shrink.val}
            onChange={shrink.set}
            min={0}
            step={1}
            style={{ width: '60px' }}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
