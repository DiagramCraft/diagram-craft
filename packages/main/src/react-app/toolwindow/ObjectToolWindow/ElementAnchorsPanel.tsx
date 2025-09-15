import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from '../ObjectToolWindow/types';
import { useDiagram } from '../../../application';
import { Button } from '@diagram-craft/app-components/Button';
import { newid } from '@diagram-craft/utils/id';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

type CustomAnchorsEditorProps = {
  customAnchors: {
    val: Record<string, { x: number; y: number }> | undefined;
    set: (value: Record<string, { x: number; y: number }> | undefined) => void;
  };
  disabled: boolean;
  onChange: () => void;
};

const CustomAnchorsEditor = ({ customAnchors, disabled, onChange }: CustomAnchorsEditorProps) => {
  return (
    <>
      <div className={'cmp-labeled-table__label util-a-top-center'} style={{ marginTop: '4px' }}>
        Anchors:
      </div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {Object.entries(customAnchors.val ?? {}).map(
            ([id, anchor]: [string, { x: number; y: number }]) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
                  <NumberInput
                    value={anchor.x ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    label={'x'}
                    onChange={x => {
                      const newAnchors = { ...(customAnchors.val ?? {}) };
                      newAnchors[id] = {
                        ...newAnchors[id],
                        x: Math.max(0, Math.min(1, x ?? 0))
                      };
                      customAnchors.set(newAnchors);
                      onChange();
                    }}
                    style={{ width: '60px' }}
                    disabled={disabled}
                  />
                  <NumberInput
                    value={anchor.y ?? 0}
                    min={0}
                    max={1}
                    step={0.01}
                    label={'y'}
                    onChange={y => {
                      const newAnchors = { ...(customAnchors.val ?? {}) };
                      newAnchors[id] = {
                        ...newAnchors[id],
                        y: Math.max(0, Math.min(1, y ?? 0))
                      };
                      customAnchors.set(newAnchors);
                      onChange();
                    }}
                    style={{ width: '60px' }}
                    disabled={disabled}
                  />
                </div>
                <Button
                  type="icon-only"
                  onClick={() => {
                    const newAnchors = { ...(customAnchors.val ?? {}) };
                    delete newAnchors[id];
                    const isEmpty = Object.keys(newAnchors).length === 0;
                    customAnchors.set(isEmpty ? undefined : newAnchors);
                    onChange();
                  }}
                  disabled={disabled}
                >
                  <TbTrash />
                </Button>
              </div>
            )
          )}

          <Button
            type={'secondary'}
            onClick={() => {
              const id = newid();
              const newAnchors = { ...(customAnchors.val ?? {}) };
              newAnchors[id] = { x: 0.5, y: 0.5 };
              customAnchors.set(newAnchors);
            }}
            disabled={disabled}
            style={{ alignSelf: 'flex-start' }}
          >
            <span style={{ marginRight: '0.5rem' }}>
              <TbPlus />
            </span>{' '}
            Add Anchor
          </Button>
        </div>
      </div>
    </>
  );
};

export const ElementAnchorsPanel = (props: Props) => {
  const diagram = useDiagram();
  const type = useNodeProperty(diagram, 'anchors.type');
  const perEdge = useNodeProperty(diagram, 'anchors.perEdgeCount');
  const perPathCount = useNodeProperty(diagram, 'anchors.perPathCount');
  const directionsCount = useNodeProperty(diagram, 'anchors.directionsCount');
  const customAnchors = useNodeProperty(diagram, 'anchors.customAnchors', {});

  const disabled =
    !diagram.selectionState.isNodesOnly() ||
    diagram.selectionState.nodes.some(e => !e.getDefinition().supports('anchors-configurable'));

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="anchors"
      title={'Anchor Points'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor
            property={type as Property<string>}
            render={props => (
              <Select.Root {...props}>
                <Select.Item value={'none'}>No anchors</Select.Item>
                <Select.Item value={'shape-defaults'}>Default</Select.Item>
                <Select.Item value={'north-south'}>North/South</Select.Item>
                <Select.Item value={'east-west'}>East/West</Select.Item>
                <Select.Item value={'directions'}>x anchors (direction)</Select.Item>
                <Select.Item value={'per-path'}>x anchors (length)</Select.Item>
                <Select.Item value={'per-edge'}>x per edge</Select.Item>
                <Select.Item value={'custom'}>Custom</Select.Item>
              </Select.Root>
            )}
          />
        </div>

        {type.val !== 'custom' && (
          <>
            <div className={'cmp-labeled-table__label'}>Number:</div>
            <div className={'cmp-labeled-table__value'}>
              <NumberInput
                value={
                  type.val === 'per-edge'
                    ? perEdge.val
                    : type.val === 'directions'
                      ? directionsCount.val
                      : type.val === 'per-path'
                        ? perPathCount.val
                        : 0
                }
                disabled={
                  disabled ||
                  (type.val !== 'per-edge' && type.val !== 'directions' && type.val !== 'per-path')
                }
                onChange={v => {
                  if (type.val === 'per-edge') {
                    perEdge.set(v);
                  } else if (type.val === 'directions') {
                    directionsCount.set(v);
                  } else if (type.val === 'per-path') {
                    perPathCount.set(v);
                  }
                }}
              />
            </div>
          </>
        )}

        {type.val === 'custom' && (
          <CustomAnchorsEditor
            customAnchors={customAnchors}
            disabled={disabled}
            onChange={() => {
              const uow = new UnitOfWork(diagram, false);
              diagram.selectionState.nodes.forEach(node => {
                node.invalidateAnchors(uow);
              });
              uow.commit();
            }}
          />
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
