import { TbChevronDown, TbDots } from 'react-icons/tb';
import React, { useCallback, useRef } from 'react';
import { range } from '@diagram-craft/utils/array';
import { Popover } from '@diagram-craft/app-components/Popover';
import { extractMouseEvents } from '@diagram-craft/app-components/utils';

const transpose = (matrix: string[][]) =>
  Object.keys(matrix[0]).map(colNumber =>
    matrix.map(rowNumber => rowNumber[colNumber as unknown as number])
  );

const EditableColorWell = (props: { color: string; onChange: (s: string) => void }) => {
  const [color, setColor] = React.useState(props.color);
  return (
    <div className={'cmp-color-grid__editable'} style={{ backgroundColor: color }}>
      <button
        onClick={() => {
          props.onChange(color);
        }}
      ></button>
      <input
        type="color"
        value={color}
        onDoubleClick={e => {
          e.currentTarget.select();
        }}
        onInput={v => {
          setColor(v.currentTarget.value);
        }}
        onChange={v => {
          setColor(v.currentTarget.value);
        }}
      />
      <TbDots />
    </div>
  );
};

const recentColors: string[] = [];

export const ColorPicker = (props: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const close = () => {
    setOpen(false);
  };

  const setColor = useCallback(
    (c: string) => {
      close();
      props.onChange(c);
      if (c && c !== '' && !recentColors.includes(c)) {
        recentColors.unshift(c);
        recentColors.splice(14);
      }
    },
    [props]
  );

  return (
    <div className={'cmp-color-picker'}>
      <Popover.Root open={open} onOpenChange={o => setOpen(o)}>
        <Popover.Trigger>
          <button
            {...extractMouseEvents(props)}
            data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
            disabled={props.disabled}
          >
            <div
              className={'cmp-color-picker__well'}
              style={{
                backgroundColor: props.value,
                border: props.isIndeterminate ? '1px dotted var(--slate-8)' : undefined
              }}
            >
              {props.isIndeterminate && <TbDots style={{ margin: '0px' }} />}
            </div>
            <TbChevronDown size={'11px'} />
          </button>
        </Popover.Trigger>
        <Popover.Content sideOffset={5} ref={contentRef}>
          <div className={'cmp-color-grid'}>
            <h2>Colors</h2>

            {props.canClearColor && (
              <div
                className={'cmp-color-grid__row'}
                style={{
                  marginBottom: '0.25rem'
                }}
              >
                <button
                  style={{
                    background:
                      'linear-gradient(to right bottom, white 48%, red 48%, red 52%, white 52%)'
                  }}
                  onClick={() => {
                    setColor('');
                  }}
                ></button>
              </div>
            )}

            {transpose(props.palette).map(arr => {
              return arr.map((c, idx) => (
                <button
                  key={idx}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    setColor(c);
                  }}
                ></button>
              ));
            })}

            <h2>Standard colors</h2>
            {['red', 'green', 'blue', 'yellow', 'gray', 'white', 'black'].map(c => (
              <button
                key={c}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                }}
              ></button>
            ))}

            {recentColors.length > 0 && (
              <>
                <h2>Recent colors</h2>
                {recentColors.map(c => (
                  <button
                    key={c}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setColor(c);
                    }}
                  ></button>
                ))}
              </>
            )}

            <h2>Custom palette</h2>
            {range(0, 14).map(i => (
              <EditableColorWell
                key={i}
                color={props.customPalette[i]}
                onChange={c => {
                  setColor(c);
                  props.onChangeCustomPalette(i, c);
                }}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
};

type Props = {
  palette: string[][];
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
  customPalette: string[];
  value: string;
  onChange: (s: string | undefined) => void;
  onChangeCustomPalette: (idx: number, s: string) => void;
  canClearColor?: boolean;
  disabled?: boolean;
};

export const ColorPreview = (props: { value: string }) => {
  return (
    <div
      className={'cmp-color-picker__well'}
      style={{
        width: '12px',
        height: '12px',
        border: '1px solid var(--cmp-border)',
        backgroundColor: props.value
      }}
    ></div>
  );
};
