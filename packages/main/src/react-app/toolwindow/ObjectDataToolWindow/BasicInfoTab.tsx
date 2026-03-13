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
import { isNode } from '@diagram-craft/model/diagramElement';
import { DataFields } from './DataFields';
import React from 'react';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

type ObjectNamePanelProps = {
  mode: 'accordion' | 'panel' | 'headless';
};

export const BasicInfoTab = ({ mode }: ObjectNamePanelProps) => {
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

  const mustHaveSchemas =
    $d.selection.type === 'nodes' || $d.selection.type === 'single-node'
      ? [
          ...$d.selection.elements
            .filter(isNode)
            .map(e => new Set(e.getDefinition().getCustomPropertyDefinitions(e).dataSchemas))
            .reduce((acc, set) => new Set([...acc].filter(x => set.has(x))))
            .entries()
        ].map(([k]) => $d.document.data.db.getSchema(k.id))
      : [];

  const hasOtherName = mustHaveSchemas.some(s => s.fields.some(f => f.id === 'name'));

  return (
    <ToolWindowPanel mode={mode} id="basic" title="Name">
      {mustHaveSchemas && (
        <div style={{ color: 'var(--panel-fg)', marginBottom: '0.5rem' }}>Basic Info</div>
      )}

      <KeyValueTable.Root>
        {!hasOtherName && (
          <React.Fragment>
            <KeyValueTable.Label>Name:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <TextInput value={name.val} onChange={v => name.set(v)} />
            </KeyValueTable.Value>
          </React.Fragment>
        )}

        <KeyValueTable.Label>Tags:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <MultiSelect
            selectedValues={selectedTags}
            availableItems={availableTags}
            onSelectionChange={handleTagsChange}
            allowCustomValues={true}
            isIndeterminate={isIndeterminate}
            placeholder="Add tags..."
          />
        </KeyValueTable.Value>

        <KeyValueTable.Label valign={'top'}>Tooltip:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <TextArea
            value={tooltip.val}
            onChange={v => tooltip.set(v)}
            style={{ minHeight: '60px' }}
            placeholder="Enter tooltip text..."
          />
        </KeyValueTable.Value>
      </KeyValueTable.Root>

      {[...(mustHaveSchemas ?? [])].map(s => (
        <div key={s.id} style={{ marginTop: '1rem' }}>
          <div style={{ color: 'var(--panel-fg)', marginBottom: '0.5rem' }}>{s.name}</div>
          <KeyValueTable.Root type="inline">
            <DataFields schema={s} />
          </KeyValueTable.Root>
        </div>
      ))}
    </ToolWindowPanel>
  );
};
