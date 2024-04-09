import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { ARROW_SHAPES } from '../../canvas/arrowShapes.ts';
import { ArrowPreview } from './ArrowPreview.tsx';

const PREVIEW_SCALE = 0.75;

export const ArrowSelector = (props: Props) => {
  return (
    <Select.Root value={props.value} onValueChange={props.onValueChange}>
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value
          placeholder={
            <ArrowPreview
              bg={'var(--secondary-bg)'}
              width={30}
              type={props.value ?? 'NONE'}
              end={ARROW_SHAPES[props.value ?? 'NONE']?.(PREVIEW_SCALE)}
            />
          }
        />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              <Select.Item key={'NONE'} className={'cmp-select-content__item'} value={'NONE'}>
                <Select.ItemText>
                  <ArrowPreview
                    width={30}
                    type={'NONE'}
                    end={undefined}
                    bg={'var(--secondary-bg)'}
                  />
                </Select.ItemText>
                <Select.ItemIndicator className="cmp-select-content__item-indicator">
                  <TbCheck />
                </Select.ItemIndicator>
              </Select.Item>
              {Object.keys(ARROW_SHAPES).map(type => {
                const arrow = ARROW_SHAPES[type]?.(PREVIEW_SCALE);
                return (
                  <Select.Item key={type} className={'cmp-select-content__item'} value={type}>
                    <Select.ItemText>
                      <ArrowPreview width={30} type={type} end={arrow} bg={'var(--secondary-bg)'} />
                    </Select.ItemText>
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
  );
};

interface Props {
  value?: string;
  onValueChange: (value: string | undefined) => void;
}
