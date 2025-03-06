import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSearch } from 'react-icons/tb';
import { useRef, useState } from 'react';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { useDocument } from '../../../application';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { ObjectPicker } from './ObjectPicker';
import { PickerConfig } from './pickerConfig';

export const PickerSearch = () => {
  const ref = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  const document = useDocument();
  const stencilRegistry = document.nodeDefinitions.stencilRegistry;

  let stencils: Stencil[] = [];
  if (!isEmptyString(search)) {
    stencils = stencilRegistry.search(search);
  }

  return (
    <div>
      <div className={'util-hstack'}>
        <TextInput
          ref={ref}
          value={search}
          style={{ flexGrow: 1 }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setSearch(e.currentTarget.value);
            }
          }}
          onClear={() => {
            setSearch('');
          }}
        />
        <Button
          onClick={() => {
            setSearch(ref.current?.value ?? '');
            ref.current?.blur();
          }}
          type={'secondary'}
        >
          <TbSearch />
        </Button>
      </div>

      {!isEmptyString(search) && (
        <div className={'cmp-object-picker'} style={{ marginTop: '0.75rem' }}>
          <ObjectPicker stencils={stencils} size={PickerConfig.size} />
        </div>
      )}
    </div>
  );
};
