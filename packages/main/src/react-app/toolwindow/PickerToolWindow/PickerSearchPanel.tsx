import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSearch } from 'react-icons/tb';
import { useCallback, useRef, useState } from 'react';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { useDocument } from '../../../application';
import { Stencil } from '@diagram-craft/model/stencilRegistry';
import { ObjectPickerPanel } from './ObjectPickerPanel';
import { ToolWindowPanel } from '../ToolWindowPanel';

export const PickerSearchPanel = () => {
  const ref = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [stencils, setStencils] = useState<Stencil[]>([]);

  const document = useDocument();
  const stencilRegistry = document.registry.stencils;

  const doSearch = useCallback(
    (query: string) => {
      setSearch(query);

      if (isEmptyString(query)) {
        setStencils([]);
      } else {
        stencilRegistry.search(query).then(results => {
          setStencils(results);
        });
      }
    },
    [stencilRegistry]
  );

  return (
    <ToolWindowPanel mode={'headless'} id={'search'} title={'Search'}>
      <div className={'util-hstack'}>
        <TextInput
          ref={ref}
          value={search}
          style={{ flexGrow: 1 }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              doSearch(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              doSearch('');
              // Force the TextInput's internal state to clear
              setTimeout(() => {
                if (ref.current) {
                  ref.current.value = '';
                }
              }, 0);
            }
          }}
          onClear={() => {
            doSearch('');
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
          <ObjectPickerPanel
            stencils={stencils}
            id={'search'}
            title={'Search results'}
            isOpen={true}
            mode={'headless-no-padding'}
          />
        </div>
      )}
    </ToolWindowPanel>
  );
};
