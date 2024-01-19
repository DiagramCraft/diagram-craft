import * as ReactSelect from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';

export const Select = (props: Props) => {
  return (
    <ReactSelect.Root onValueChange={props.onValueChange} value={props.value}>
      <ReactSelect.Trigger className="cmp-select-trigger">
        <ReactSelect.Value placeholder={''} />
        <ReactSelect.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </ReactSelect.Icon>
      </ReactSelect.Trigger>
      <ReactSelect.Portal>
        <ReactSelect.Content className="cmp-select-content">
          <ReactSelect.Viewport className="cmp-select-content__viewpoint">
            <ReactSelect.Group>
              {props.values.map(v => (
                <ReactSelect.Item
                  className={'cmp-select-content__item'}
                  key={v.value}
                  value={v.value}
                >
                  <ReactSelect.ItemText>{v.label}</ReactSelect.ItemText>
                  <ReactSelect.ItemIndicator className="cmp-select-content__item-indicator">
                    <TbCheck />
                  </ReactSelect.ItemIndicator>
                </ReactSelect.Item>
              ))}
            </ReactSelect.Group>
          </ReactSelect.Viewport>
        </ReactSelect.Content>
      </ReactSelect.Portal>
    </ReactSelect.Root>
  );
};

type Props = {
  values: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
};
