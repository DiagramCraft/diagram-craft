import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { AdjustmentRule, AdjustmentRuleAction } from '@diagram-craft/model/diagramLayerRule';
import React, { ReactElement, useEffect, useRef, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbLine, TbPentagon, TbPlus, TbTrash } from 'react-icons/tb';
import { PropsEditor } from '@diagram-craft/canvas-app/PropsEditor';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../context/DiagramContext';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { NodeFillPanelForm } from '../../toolwindow/ObjectToolWindow/NodeFillPanel';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { Property } from '../../toolwindow/ObjectToolWindow/types';
import { useRedraw } from '../../hooks/useRedraw';
import { deepClone } from '@diagram-craft/utils/object';
import { elementDefaults } from '@diagram-craft/model/diagramDefaults';
import { assert, NotImplementedYet } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      ruleEditor: {
        props: {
          rule: AdjustmentRule;
        };
        callback: AdjustmentRule;
      };
    }
  }
}

type Editor = (props: { props: NodeProps | EdgeProps }) => ReactElement;

function makeProperty<TObj, K extends PropPath<TObj>, V extends PropPathValue<TObj, K>>(
  obj: TObj,
  propertyPath: PropPath<TObj>,
  defaults: TObj,
  onChange: (v: V) => void
): Property<V> {
  const accessor = new DynamicAccessor<TObj>();
  return {
    val: (accessor.get(obj, propertyPath) as V) ?? (accessor.get(defaults, propertyPath) as V),
    set: (v: V) => {
      accessor.set(obj, propertyPath, v);
      onChange(v);
    },
    hasMultipleValues: false
  } as Property<V>;
}

const FillColor: Editor = (props: { props: NodeProps | EdgeProps }) => {
  const $p = props.props;

  const $cfg = useConfiguration();
  const diagram = useDiagram();
  const redraw = useRedraw();

  return (
    <NodeFillPanelForm
      config={$cfg}
      diagram={diagram}
      type={makeProperty($p, 'fill.type', elementDefaults, redraw)}
      imageBrightness={makeProperty($p, 'fill.image.brightness', elementDefaults, redraw)}
      imageScale={makeProperty($p, 'fill.image.scale', elementDefaults, redraw)}
      imageContrast={makeProperty($p, 'fill.image.contrast', elementDefaults, redraw)}
      color={makeProperty($p, 'fill.color', elementDefaults, redraw)}
      imageSaturation={makeProperty($p, 'fill.image.saturation', elementDefaults, redraw)}
      color2={makeProperty($p, 'fill.color2', elementDefaults, redraw)}
      image={makeProperty($p, 'fill.image.id', elementDefaults, redraw)}
      gradientDirection={makeProperty($p, 'fill.gradient.direction', elementDefaults, redraw)}
      gradientType={makeProperty($p, 'fill.gradient.type', elementDefaults, redraw)}
      imageFit={makeProperty($p, 'fill.image.fit', elementDefaults, redraw)}
      imageH={makeProperty($p, 'fill.image.h', elementDefaults, redraw)}
      imageTint={makeProperty($p, 'fill.image.tint', elementDefaults, redraw)}
      imageTintStrength={makeProperty($p, 'fill.image.tintStrength', elementDefaults, redraw)}
      imageW={makeProperty($p, 'fill.image.w', elementDefaults, redraw)}
      pattern={makeProperty($p, 'fill.pattern', elementDefaults, redraw)}
    />
  );
};

const EDITORS = {
  fill: FillColor
};

const normalizeRuleActions = (rule: AdjustmentRule | undefined) => {
  if (!rule) return rule;

  const dest: Array<AdjustmentRuleAction> = [];
  for (const a of rule.actions) {
    if (a.type === 'set-props') {
      const propsEditor = new PropsEditor<Editor>(EDITORS, a.props);
      for (const e of propsEditor.getEntries()) {
        dest.push({
          id: newid(),
          type: 'set-props',
          props: e.props
        });
      }
    } else {
      dest.push(a);
    }
  }
  rule.actions = dest;
  return rule;
};

export const RuleEditorDialog = (props: Props) => {
  const [rule, setRule] = useState(normalizeRuleActions(deepClone(props.rule)));
  useEffect(() => {
    setRule(normalizeRuleActions(deepClone(props.rule)));
  }, [props.rule]);

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });

  if (!props.rule || !rule) return null;

  return (
    <Dialog
      open={props.open}
      onClose={() => {}}
      buttons={[
        {
          type: 'cancel',
          onClick: () => {
            props.onCancel?.();
          },
          label: 'Cancel'
        },
        {
          type: 'secondary',
          onClick: () => {},
          label: 'Preview'
        },
        {
          type: 'default',
          onClick: () => {
            console.log(rule);
          },
          label: 'Save'
        }
      ]}
      title={'Rule Editor'}
    >
      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr max-content' }}>
        <div>
          <label>{'Name'}:</label>
          <div className={'cmp-text-input'}>
            <input
              ref={ref}
              type={'text'}
              size={40}
              defaultValue={rule?.name ?? ''}
              onKeyDown={e => {
                // TODO: Why is this needed?
                e.stopPropagation();
              }}
            />
          </div>
        </div>
        <div>
          <label>{'Type'}:</label>
          <div>
            <ToggleButtonGroup.Root
              type={'multiple'}
              value={['node', 'edge']}
              onValueChange={(_value: string[]) => {}}
            >
              <ToggleButtonGroup.Item value={'node'}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <TbPentagon /> Node
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'edge'}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <TbLine /> Edge
                </div>
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'grid',
            margin: '0.5rem 0 2rem 0',
            gap: '0.5rem',
            gridTemplateColumns: '2fr 8fr min-content min-content'
          }}
        >
          <h4 style={{ margin: '0.5rem 0 0 0' }}>If</h4>
          <div></div>
          <div></div>
          <div></div>

          {rule.clauses.map(c => {
            if (c.type === 'query') {
              return (
                <React.Fragment key={c.id}>
                  <Select.Root value={'query'} onValueChange={() => {}}>
                    <Select.Item value={'query'}>Query</Select.Item>
                  </Select.Root>

                  <div className={'cmp-text-input'}>
                    <textarea
                      style={{ height: '3rem' }}
                      defaultValue={c.query ?? ''}
                      onKeyDown={e => {
                        // TODO: Why is this needed?
                        e.stopPropagation();
                      }}
                    />
                  </div>

                  <Button type={'icon-only'}>
                    <TbPlus />
                  </Button>
                  <Button type={'icon-only'} disabled={true}>
                    <TbTrash />
                  </Button>
                </React.Fragment>
              );
            } else {
              throw new NotImplementedYet();
            }
          })}

          <h4 style={{ margin: '0.5rem 0 0 0' }}>Then</h4>
          <div></div>
          <div></div>
          <div></div>

          {rule?.actions.map(action => {
            if (action.type === 'set-props') {
              const propsEditor = new PropsEditor(EDITORS, action.props);
              const entries = propsEditor.getEntries();
              assert.arrayWithExactlyOneElement(entries);
              const entry = entries[0];

              return (
                <React.Fragment key={action.id}>
                  <Select.Root value={'style'} onValueChange={() => {}}>
                    <Select.Item value={'style'}>Set style</Select.Item>
                    <Select.Item value={'stylesheet'}>Set stylesheet</Select.Item>
                    <Select.Item value={'hide'}>Hide</Select.Item>
                  </Select.Root>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Select.Root value={entry.id} placeholder={'Style'} onValueChange={() => {}}>
                      {propsEditor.getAllEntries().map(e => {
                        return (
                          <Select.Item key={e.id} value={e.id}>
                            {e.name}
                          </Select.Item>
                        );
                      })}
                    </Select.Root>

                    <div
                      style={{
                        border: '1px solid var(--cmp-border)',
                        borderRadius: 'var(--cmp-radius)',
                        padding: '0.5rem',
                        width: '250px',
                        maxWidth: '250px'
                      }}
                    >
                      <entry.editor props={action.props ?? {}} />
                    </div>
                  </div>

                  <Button type={'icon-only'}>
                    <TbPlus />
                  </Button>
                  <Button type={'icon-only'} disabled={true}>
                    <TbTrash />
                  </Button>
                </React.Fragment>
              );
            } else {
              throw new NotImplementedYet();
            }
          })}
        </div>
      </div>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onSave: (rule: AdjustmentRule) => void;
  onCancel: (() => void) | undefined;
  rule?: AdjustmentRule;
};
