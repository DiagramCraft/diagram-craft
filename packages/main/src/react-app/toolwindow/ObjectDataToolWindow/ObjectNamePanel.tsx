import { useCallback } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useElementMetadata } from '../../hooks/useProperty';
import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { unique } from '@diagram-craft/utils/array';

type ObjectNamePanelProps = {
  mode: 'accordion' | 'panel' | 'headless';
};

export const ObjectNamePanel = ({ mode }: ObjectNamePanelProps) => {
  const $d = useDiagram();
  const redraw = useRedraw();
  const name = useElementMetadata($d, 'name', '');
  const tooltip = useElementMetadata($d, 'tooltip', '');

  // Custom hook logic for managing element tags
  const selectedTags = unique($d.selection.elements.flatMap(e => [...e.tags]));
  const isIndeterminate =
    $d.selection.elements.length > 1 &&
    $d.selection.elements.some(e =>
      $d.selection.elements.some(
        other => JSON.stringify([...e.tags].sort()) !== JSON.stringify([...other.tags].sort())
      )
    );

  const availableTags = [...$d.document.tags.tags].map(tag => ({ value: tag, label: tag }));

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      UnitOfWork.executeWithUndo($d, 'Update element tags', uow => {
        $d.selection.elements.forEach(element => {
          element.setTags(newTags, uow);
        });
      });

      redraw();
    },
    [$d, redraw]
  );

  return (
    <ToolWindowPanel mode={mode} id="basic" title="Name">
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label util-a-top-center'}>Name:</div>
        <div className={'cmp-labeled-table__value'}>
          <TextInput value={name.val} onChange={v => name.set(v)} />
        </div>
        <div className={'cmp-labeled-table__label util-a-top-center'}>Tags:</div>
        <div className={'cmp-labeled-table__value'}>
          <MultiSelect
            selectedValues={selectedTags}
            availableItems={availableTags}
            onSelectionChange={handleTagsChange}
            allowCustomValues={true}
            isIndeterminate={isIndeterminate}
            placeholder="Add tags..."
          />
        </div>
        <div className={'cmp-labeled-table__label util-a-top-center'}>Tooltip:</div>
        <div className={'cmp-labeled-table__value'}>
          <TextArea
            value={tooltip.val}
            onChange={v => tooltip.set(v)}
            style={{ minHeight: '60px' }}
            placeholder="Enter tooltip text..."
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};
