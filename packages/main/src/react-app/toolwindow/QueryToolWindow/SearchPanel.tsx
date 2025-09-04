import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSearch } from 'react-icons/tb';
import { useRef } from 'react';
import { ToolWindowPanel } from '../ToolWindowPanel';

type SearchPanelProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSearch: (value: string) => void;
  scope: string;
  onScopeChange: (value: string) => void;
};

export const SearchPanel = ({
  searchText,
  onSearchTextChange,
  onSearch,
  scope,
  onScopeChange
}: SearchPanelProps) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <ToolWindowPanel mode={'headless'} id={'search-input'} title={'Search'}>
      <div>
        <div style={{ marginBottom: '0.25rem' }}>
          <Select.Root onChange={value => onScopeChange(value ?? 'active-layer')} value={scope}>
            <Select.Item value={'active-layer'}>Active Layer</Select.Item>
            <Select.Item value={'active-diagram'}>Active Diagram</Select.Item>
            <Select.Item value={'active-document'}>Active Document</Select.Item>
          </Select.Root>
        </div>
        <div className={'util-hstack'}>
          <TextInput
            ref={ref}
            value={searchText}
            onChange={value => onSearchTextChange(value ?? '')}
            placeholder="Search..."
            style={{ flexGrow: 1 }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onSearch(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onSearchTextChange('');
                // Force the TextInput's internal state to clear
                setTimeout(() => {
                  if (ref.current) {
                    ref.current.value = '';
                  }
                }, 0);
              }
            }}
            onClear={() => {
              onSearchTextChange('');
            }}
          />
          <Button
            onClick={() => {
              onSearch(ref.current?.value ?? '');
              ref.current?.blur();
            }}
            type={'secondary'}
          >
            <TbSearch />
          </Button>
        </div>
      </div>
    </ToolWindowPanel>
  );
};
