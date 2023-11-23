import * as Popover from '@radix-ui/react-popover';
import { TbColorSwatch, TbX } from 'react-icons/tb';
import { useRef } from 'react';

const transpose = (matrix: string[][]) =>
  Object.keys(matrix[0]).map(colNumber =>
    matrix.map(rowNumber => rowNumber[colNumber as unknown as number])
  );

export const ColorPicker = (props: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // TODO: Need to figure out how to close this once a color has been selected
  const close = () => {
    contentRef.current!.dataset['state'] = 'closed';
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="color-button" aria-label="Update dimensions">
          <div
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: props.color,
              border: '1px solid var(--primary-fg)'
            }}
          ></div>
          <TbColorSwatch size={'1rem'} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="PopoverContent" sideOffset={5} ref={contentRef}>
          <h2>Colors</h2>

          <div className={'color-grid'}>
            <div className={'color-grid__primary'}>
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
              <div className={'color-grid__additional'}>
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
          <Popover.Close className="PopoverClose" aria-label="Close">
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="PopoverArrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

type Props = {
  primaryColors: string[];
  additionalHues?: string[][];
  color: string;
  onClick: (s: string) => void;
};
