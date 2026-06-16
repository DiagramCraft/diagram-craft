import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';

export const MetadataFields = (props: { document: DiagramDocument }) => {
  const { document } = props;
  const redraw = useRedraw();

  useEventListener(document.props.metadata, 'change', redraw);

  const handleChange = (
    field: 'title' | 'company' | 'category' | 'keywords' | 'description',
    value: string
  ) => {
    document.props.metadata[field] = value;
  };

  return (
    <KeyValueTable.Root>
      <KeyValueTable.Label>Title</KeyValueTable.Label>
      <KeyValueTable.Value>
        <TextInput
          value={document.props.metadata.title}
          onChange={value => handleChange('title', value ?? '')}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Company</KeyValueTable.Label>
      <KeyValueTable.Value>
        <TextInput
          value={document.props.metadata.company}
          onChange={value => handleChange('company', value ?? '')}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Category</KeyValueTable.Label>
      <KeyValueTable.Value>
        <TextInput
          value={document.props.metadata.category}
          onChange={value => handleChange('category', value ?? '')}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Keywords</KeyValueTable.Label>
      <KeyValueTable.Value>
        <TextInput
          value={document.props.metadata.keywords}
          onChange={value => handleChange('keywords', value ?? '')}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label valign="top">Description</KeyValueTable.Label>
      <KeyValueTable.Value>
        <TextArea
          value={document.props.metadata.description}
          onChange={value => handleChange('description', value ?? '')}
          rows={3}
          allowMaximize={false}
        />
      </KeyValueTable.Value>
    </KeyValueTable.Root>
  );
};
