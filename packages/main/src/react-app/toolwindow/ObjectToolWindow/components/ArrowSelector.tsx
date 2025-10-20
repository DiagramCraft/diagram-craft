import { ArrowPreview } from './ArrowPreview';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { Select } from '@diagram-craft/app-components/Select';
import { PropertyEditor } from '../../../components/PropertyEditor';
import type { Property } from '@diagram-craft/model/property';

const PREVIEW_SCALE = 0.75;

export const ArrowSelector = (props: Props) => {
  return (
    <PropertyEditor
      property={props.property}
      render={props => (
        <Select.Root {...props}>
          <Select.Item key={'NONE'} value={'NONE'}>
            <ArrowPreview width={30} type={'NONE'} end={undefined} bg={'var(--cmp-bg)'} />
          </Select.Item>
          {Object.keys(ARROW_SHAPES).map(type => {
            const arrow = ARROW_SHAPES[type]?.(PREVIEW_SCALE, 1);
            return (
              <Select.Item key={type} value={type}>
                <ArrowPreview width={30} type={type} end={arrow} bg={'var(--cmp-bg)'} />
              </Select.Item>
            );
          })}
        </Select.Root>
      )}
      renderValue={props => {
        const type = props.value;
        const arrow = ARROW_SHAPES[type]?.(PREVIEW_SCALE, 1);
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--cmp-bg)',
              padding: '5px 10px',
              borderRadius: '2px'
            }}
          >
            <ArrowPreview width={30} type={type} end={arrow} bg={'var(--cmp-bg)'} />
          </div>
        );
      }}
    />
  );
};

interface Props {
  property: Property<string>;
}
