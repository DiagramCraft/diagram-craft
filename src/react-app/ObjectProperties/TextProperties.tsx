import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useNodeProperty.ts';
import * as Select from '@radix-ui/react-select';
import {
  TbAlignCenter,
  TbAlignLeft,
  TbAlignRight,
  TbBold,
  TbCheck,
  TbChevronDown,
  TbItalic,
  TbLetterCase,
  TbLetterCaseUpper,
  TbUnderline
} from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { RxTextAlignBottom, RxTextAlignMiddle, RxTextAlignTop } from 'react-icons/rx';
import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';

const FONTS = {
  Times: 'Times',
  Arial: 'Arial',
  Helvetica: 'Helvetica',
  Verdana: 'Verdana',
  Courier: 'Courier',
  'Comic Sans': 'Comic Sans MS',
  Impact: 'Impact',
  Tahoma: 'Tahoma',
  Trebuchet: 'Trebuchet MS',
  Georgia: 'Georgia'
};

export const TextProperties = (props: Props) => {
  // TODO: Should be useElementProperty
  const [font, setFont] = useNodeProperty('text.font', props.diagram, 'Arial');
  const [fontSize, setFontSize] = useNodeProperty('text.fontSize', props.diagram, '10');

  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Font:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type={'number'}
            value={fontSize ?? 10}
            min={1}
            style={{ width: '45px' }}
            onChange={ev => {
              setFontSize(ev.target.value);
            }}
          />
          &nbsp;
          <Select.Root value={font} onValueChange={setFont}>
            <Select.Trigger className="cmp-select-trigger">
              <Select.Value placeholder={font} />
              <Select.Icon className="cmp-select-trigger__icon">
                <TbChevronDown />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="cmp-select-content">
                <Select.Viewport className="cmp-select-content__viewpoint">
                  <Select.Group>
                    {Object.entries(FONTS).map(([label, value]) => {
                      return (
                        <Select.Item
                          key={value}
                          className={'cmp-select-content__item'}
                          value={value}
                        >
                          <Select.ItemText>{label}</Select.ItemText>
                          <Select.ItemIndicator className="cmp-select-content__item-indicator">
                            <TbCheck />
                          </Select.ItemIndicator>
                        </Select.Item>
                      );
                    })}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      <div></div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'multiple'}
              value={[]}
              onValueChange={value => {
                console.log(value);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'letter-case'}>
                <TbBold />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'upper-case'}>
                <TbItalic />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'upper-case'}>
                <TbUnderline />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
          &nbsp;
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={'letter-case'}
              onValueChange={value => {
                console.log(value);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'letter-case'}>
                <TbLetterCase />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'upper-case'}>
                <TbLetterCaseUpper />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>
      </div>

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value'}>
        <ColorPicker
          primaryColors={primaryColors}
          additionalHues={additionalHues}
          color={'a' ?? 'transparent'}
          onClick={() => {}}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Align:</div>
      <div className={'cmp-labeled-table__value'}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={'center'}
              onValueChange={value => {
                console.log(value);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'left'}>
                <TbAlignLeft />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'center'}>
                <TbAlignCenter />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'right'}>
                <TbAlignRight />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
          &nbsp;
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={'middle'}
              onValueChange={value => {
                console.log(value);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'top'}>
                <RxTextAlignTop />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'middle'}>
                <RxTextAlignMiddle />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bottom'}>
                <RxTextAlignBottom />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>
      </div>

      <div className={'cmp-labeled-table__label'}>Spacing:</div>
      <div className={'cmp-labeled-table__value'}>
        <input
          type={'number'}
          value={'a' ?? 1}
          min={1}
          style={{ width: '45px' }}
          onChange={ev => {
            console.log(ev);
          }}
        />
      </div>
      <div></div>
      <div className={'cmp-labeled-table__value'}>
        <input
          type={'number'}
          value={'a' ?? 1}
          min={1}
          style={{ width: '45px' }}
          onChange={ev => {
            console.log(ev);
          }}
        />
        &nbsp;
        <input
          type={'number'}
          value={'a' ?? 1}
          min={1}
          style={{ width: '45px' }}
          onChange={ev => {
            console.log(ev);
          }}
        />
        &nbsp;
        <input
          type={'number'}
          value={'a' ?? 1}
          min={1}
          style={{ width: '45px' }}
          onChange={ev => {
            console.log(ev);
          }}
        />
      </div>
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
