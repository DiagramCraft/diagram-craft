import { ArrowPreview } from './ArrowPreview';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { Select } from '@diagram-craft/app-components/Select';

const PREVIEW_SCALE = 0.75;

export const ArrowSelector = (props: Props) => {
  return (
    <Select.Root value={props.value ?? 'NONE'} onValueChange={props.onValueChange}>
      <Select.Item key={'NONE'} value={'NONE'}>
        <ArrowPreview width={30} type={'NONE'} end={undefined} bg={'var(--secondary-bg)'} />
      </Select.Item>
      {Object.keys(ARROW_SHAPES).map(type => {
        const arrow = ARROW_SHAPES[type]?.(PREVIEW_SCALE, 1);
        return (
          <Select.Item key={type} value={type}>
            <ArrowPreview width={30} type={type} end={arrow} bg={'var(--secondary-bg)'} />
          </Select.Item>
        );
      })}
    </Select.Root>
  );
};

interface Props {
  value?: string;
  onValueChange: (value: string | undefined) => void;
}
