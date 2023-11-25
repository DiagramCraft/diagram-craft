import * as Popover from '@radix-ui/react-popover';
import { TbChevronDown, TbX } from 'react-icons/tb';
import React, { useRef } from 'react';

const transpose = (matrix: string[][]) =>
  Object.keys(matrix[0]).map(colNumber =>
    matrix.map(rowNumber => rowNumber[colNumber as unknown as number])
  );

export const ColorPicker = (props: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const close = () => {
    setOpen(false);
  };

  return (
    <div className={'cmp-color-picker'}>
      <Popover.Root open={open} onOpenChange={o => setOpen(o)}>
        <Popover.Trigger asChild>
          <button>
            <div
              className={'cmp-color-picker__well'}
              style={{
                backgroundColor: props.color
              }}
            ></div>
            <TbChevronDown size={'1rem'} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="cmp-popover" sideOffset={5} ref={contentRef}>
            <h2>Colors</h2>

            <div className={'cmp-color-grid'}>
              <div className={'cmp-color-grid__primary'}>
                {props.primaryColors.map(c => (
                  <button
                    key={c}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      close();
                      props.onClick?.(c);
                    }}
                  ></button>
                ))}
              </div>

              {props.additionalHues && (
                <div className={'cmp-color-grid__additional'}>
                  {transpose(props.additionalHues).map(arr => {
                    return arr.map((c, idx) => (
                      <button
                        key={idx}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          close();
                          props.onClick?.(c);
                        }}
                      ></button>
                    ));
                  })}
                </div>
              )}
            </div>

            <h2>Standard colors</h2>
            <div className={'cmp-color-grid'}>
              <div className={'cmp-color-grid__primary'}>
                {['red', 'green', 'blue', 'yellow', 'gray', 'white', 'black'].map(c => (
                  <button
                    key={c}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      close();
                      props.onClick?.(c);
                    }}
                  ></button>
                ))}
              </div>
            </div>

            <h2>Custom palette</h2>
            <div className={'cmp-color-grid'}>
              <div className={'cmp-color-grid__primary'}>
                {props.primaryColors.map(c => (
                  <button
                    key={c}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      close();
                      props.onClick?.(c);
                    }}
                  ></button>
                ))}
              </div>
            </div>

            <Popover.Close className="cmp-popover__close" aria-label="Close">
              <TbX />
            </Popover.Close>
            <Popover.Arrow className="cmp-popover__arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

type Props = {
  primaryColors: string[];
  additionalHues?: string[][];
  color: string;
  onClick: (s: string) => void;
};
