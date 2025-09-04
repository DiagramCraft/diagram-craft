import { Indicator } from '@diagram-craft/model/diagramProps';
import { useApplication, useDiagram } from '../../../application';
import { useState } from 'react';
import { deepClone } from '@diagram-craft/utils/object';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { TbFilterCog, TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { IndicatorForm } from './IndicatorForm';
import { useElementProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const path = (id: string, rest: string): any => `indicators.${id}.${rest}`;

const FormWrapper = (props: {
  indicator: Indicator;
  update: <K extends keyof Indicator>(key: K, value: Indicator[K]) => void;
  id: string;
  isReadOnly?: boolean;
}) => {
  const $d = useDiagram();
  const shape = useElementProperty($d, path(props.id, 'shape'), 'disc');
  const color = useElementProperty($d, path(props.id, 'color'), 'red');
  const width = useElementProperty($d, path(props.id, 'width'), 10);
  const height = useElementProperty($d, path(props.id, 'height'), 10);
  const offset = useElementProperty($d, path(props.id, 'offset'), 10);
  const direction = useElementProperty($d, path(props.id, 'direction'), 'e');
  const position = useElementProperty($d, path(props.id, 'position'), 'w');

  return (
    <IndicatorForm
      isReadOnly={props.isReadOnly}
      shape={shape}
      color={color}
      width={width}
      height={height}
      offset={offset}
      direction={direction}
      position={position}
    />
  );
};

export const NamedIndicatorPanel = (_props: { mode?: 'accordion' | 'panel' }) => {
  const $d = useDiagram();
  const indicators = useElementProperty($d, 'indicators');

  const application = useApplication();
  const [visible, setVisible] = useState<string[]>([]);

  const update = <K extends keyof Indicator>(id: string, key: K, value: Indicator[K]) => {
    const newIndicator: Indicator = deepClone(indicators.val[id]);
    newIndicator[key] = value;

    const newIndicators = { ...indicators.val };
    newIndicators[id] = newIndicator;
    indicators.set(newIndicators);
  };

  const add = () => {
    application.ui.showDialog(
      new StringInputDialogCommand(
        {
          title: 'New Indicator',
          description: 'Enter the name of the new indicator',
          saveButtonLabel: 'Create',
          value: 'New Indicator'
        },
        async name => {
          let newKey = name;
          let idx = 0;
          while (Object.keys(indicators).includes(newKey)) {
            idx++;
            newKey = `${name} (${idx})`;
          }

          const newIndicator: Indicator = {
            enabled: false
          };

          const newIndicators = { ...indicators.val };
          newIndicators[newKey] = newIndicator;
          indicators.set(newIndicators, 'Add indicator');

          setVisible([...visible, newKey]);
        }
      )
    );
  };

  const rename = (oldKey: string) => {
    application.ui.showDialog(
      new StringInputDialogCommand(
        {
          title: 'Rename Indicator',
          description: 'Enter new name name of the new indicator',
          saveButtonLabel: 'Rename',
          value: oldKey
        },
        async name => {
          if (name === oldKey) return;

          let newKey = name;
          let idx = 0;
          while (Object.keys(indicators.val).includes(newKey)) {
            idx++;
            newKey = `${name} (${idx})`;
          }

          const newIndicators = { ...indicators.val };
          newIndicators[newKey] = deepClone(newIndicators[oldKey]);
          delete newIndicators[oldKey];
          indicators.set(newIndicators, 'Rename indicator');

          setVisible([...visible, newKey]);
        }
      )
    );
  };

  const deleteIndicator = (key: string) => {
    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Indicator',
          message: `Are you sure you want to delete '${key}'?`,
          okType: 'danger',
          okLabel: 'Delete',
          cancelLabel: 'Cancel'
        },
        () => {
          const newIndicators = { ...indicators.val };
          delete newIndicators[key];
          indicators.set(newIndicators, 'Delete indicator');
        }
      )
    );
  };

  const indicatorKeys = Object.keys(indicators.val).filter(k => k !== '_default');

  const ruleIndicatorKeys: string[] = [];
  const enabledRruleIndicatorKeys: string[] = [];
  if ($d.selectionState.elements.length === 1) {
    const keys = Object.keys($d.selectionState.elements[0].renderProps.indicators ?? {});
    for (const k of keys) {
      if (!indicators.val[k]) {
        ruleIndicatorKeys.push(k);
        if ($d.selectionState.elements[0].renderProps.indicators[k].enabled) {
          enabledRruleIndicatorKeys.push(k);
        }
      }
    }
  }

  return (
    <ToolWindowPanel
      id={'named'}
      title={'Named Indicators'}
      mode={_props.mode ?? 'accordion'}
      headerButtons={
        <a onClick={() => add()}>
          <TbPlus />
        </a>
      }
    >
      {(indicatorKeys.length > 0 || ruleIndicatorKeys.length > 0) && (
        <>
          <Accordion.Root
            type={'multiple'}
            value={visible}
            onValueChange={v => {
              setVisible(v);
            }}
          >
            {[...Object.keys(indicators.val).filter(k => k !== '_default'), ...ruleIndicatorKeys]
              .toSorted()
              .map(k => {
                const isRuleAdded = ruleIndicatorKeys.includes(k);
                return (
                  <Accordion.Item value={k} key={k}>
                    <Accordion.ItemHeader>
                      <div className={'util-hstack'} style={{ gap: '0.5rem' }}>
                        <input
                          className="cmp-accordion__enabled"
                          type={'checkbox'}
                          checked={
                            indicators.val[k]?.enabled ??
                            enabledRruleIndicatorKeys.includes(k) ??
                            false
                          }
                          disabled={isRuleAdded}
                          onChange={() => {
                            update(k, 'enabled', !indicators.val[k]?.enabled);
                          }}
                          onClick={e => {
                            if (
                              indicators.val[k]?.enabled ||
                              (e.target as HTMLElement).parentElement!.parentElement?.dataset[
                                'state'
                              ] === 'open'
                            ) {
                              e.stopPropagation();
                            }
                          }}
                        />

                        <span>{k}</span>
                      </div>

                      {isRuleAdded && (
                        <Accordion.ItemHeaderButtons>
                          <Tooltip message={'Added by rule'}>
                            <span>
                              <TbFilterCog />
                            </span>
                          </Tooltip>
                        </Accordion.ItemHeaderButtons>
                      )}

                      {!isRuleAdded && (
                        <Accordion.ItemHeaderButtons>
                          <Tooltip message={'Delete indicator'}>
                            <a
                              href={'#'}
                              style={{ marginRight: '0.5rem' }}
                              onClick={() => deleteIndicator(k)}
                            >
                              <TbTrash />
                            </a>
                          </Tooltip>
                          <Tooltip message={'Rename indicator'}>
                            <a href={'#'} onClick={() => rename(k)}>
                              <TbPencil />
                            </a>
                          </Tooltip>
                        </Accordion.ItemHeaderButtons>
                      )}
                    </Accordion.ItemHeader>
                    <Accordion.ItemContent>
                      <FormWrapper
                        key={k}
                        id={k}
                        indicator={indicators.val[k]}
                        isReadOnly={isRuleAdded}
                        update={(p, v) => {
                          update(k, p, v);
                        }}
                      />
                    </Accordion.ItemContent>
                  </Accordion.Item>
                );
              })}
          </Accordion.Root>
          <br />
        </>
      )}

      {indicatorKeys.length === 0 && ruleIndicatorKeys.length === 0 && (
        <div>No named indicators</div>
      )}
    </ToolWindowPanel>
  );
};
