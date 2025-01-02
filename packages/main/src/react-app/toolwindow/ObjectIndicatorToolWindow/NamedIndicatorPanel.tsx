import { Indicator } from '@diagram-craft/model/diagramProps';
import { useApplication, useDiagram } from '../../../application';
import { useState } from 'react';
import { deepClone } from '@diagram-craft/utils/object';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { IndicatorForm } from './IndicatorForm';
import { useElementProperty } from '../../hooks/useProperty';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const path = (id: string, rest: string): any => `indicators.${id}.${rest}`;

const FormWrapper = (props: {
  indicator: Indicator;
  update: <K extends keyof Indicator>(key: K, value: Indicator[K]) => void;
  id: string;
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
            enabled: false,

            // TODO: Remove this and find a better way to handle defaults for dynamic objects such as indicators
            width: 10,
            height: 10,
            direction: 'e',
            color: 'red',
            shape: 'disc',
            offset: 10,
            position: 'ne'
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

  return (
    <Accordion.Item value="named">
      <Accordion.ItemHeader>
        Named Indicators
        <Accordion.ItemHeaderButtons>
          <a
            onClick={() => {
              add();
            }}
          >
            <TbPlus />
          </a>
        </Accordion.ItemHeaderButtons>
      </Accordion.ItemHeader>
      <Accordion.ItemContent>
        {Object.keys(indicators.val).filter(k => k !== '_default').length > 0 && (
          <>
            <Accordion.Root
              type={'multiple'}
              value={visible}
              onValueChange={v => {
                setVisible(v);
              }}
            >
              {Object.keys(indicators.val)
                .filter(k => k !== '_default')
                .toSorted()
                .map(k => {
                  return (
                    <Accordion.Item value={k} key={k}>
                      <Accordion.ItemHeader>
                        {k}
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
                      </Accordion.ItemHeader>
                      <Accordion.ItemContent>
                        <div className={'cmp-labeled-table'} style={{ marginBottom: '0.5rem' }}>
                          <div className={'cmp-labeled-table__label'}>Enabled:</div>
                          <div className={'cmp-labeled-table__value util-vcenter'}>
                            <Checkbox
                              value={indicators.val[k]?.enabled}
                              onChange={v => {
                                update(k, 'enabled', v ?? false);
                              }}
                            />
                          </div>
                        </div>
                        <FormWrapper
                          key={k}
                          id={k}
                          indicator={indicators.val[k]}
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

        {Object.keys(indicators.val).filter(k => k !== '_default').length === 0 && (
          <div>No named indicators</div>
        )}
      </Accordion.ItemContent>
    </Accordion.Item>
  );
};
