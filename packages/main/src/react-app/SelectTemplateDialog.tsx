import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useState } from 'react';
import type { DataTemplate } from '@diagram-craft/model/diagramDocument';
import { PickerCanvas } from './PickerCanvas';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { createThumbnailForNode } from '@diagram-craft/canvas-app/diagramThumbnail';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepClone } from '@diagram-craft/utils/object';
import { useDocument } from '../application';
import type { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';

const TEMPLATE_CACHE = new Map<string, DiagramNode>();

const makeTemplatePreview = (template: DataTemplate, definitions: Definitions): DiagramNode => {
  if (TEMPLATE_CACHE.has(template.id)) {
    return TEMPLATE_CACHE.get(template.id)!;
  }

  const tpl = deepClone(template.template);
  const { node, diagram } = createThumbnailForNode(
    (_diagram, layer, uow) => deserializeDiagramElements([tpl], layer, uow)[0] as DiagramNode,
    definitions
  );
  UnitOfWork.execute(node.diagram, uow => node.setBounds({ ...node.bounds, x: 0, y: 0 }, uow));

  diagram.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  diagram.viewBox.offset = { x: -5, y: -5 };

  TEMPLATE_CACHE.set(template.id, node);

  return node;
};

export const SelectTemplateDialog = (props: Props) => {
  const document = useDocument();
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
    props.templates[0]?.id
  );

  if (!props.open) return <div></div>;

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={props.title}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: props.onCancel! },
        {
          label: 'Update',
          type: 'default',
          onClick: () => {
            if (selectedTemplate) {
              props.onOk(selectedTemplate);
            }
          }
        }
      ]}
    >
      <div style={{ padding: '1rem 0' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{props.label}</label>
        <div
          className={'cmp-object-picker'}
          style={{
            border: '1px solid var(--cmp-border)',
            borderRadius: 'var(--cmp-radius)',
            background: 'var(--cmp-bg)',
            padding: '0.5rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          {props.templates.map(template => {
            const node = makeTemplatePreview(template, document.definitions);
            const isSelected = selectedTemplate === template.id;
            return (
              <div
                key={template.id}
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--blue-9)' : '2px solid transparent',
                  borderRadius: 'var(--cmp-radius)',
                  padding: '0.25rem'
                }}
                data-width={node.diagram.viewBox.dimensions.w}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className={'light-theme'}>
                  <PickerCanvas
                    width={42}
                    height={42}
                    diagramWidth={node.diagram.viewBox.dimensions.w}
                    diagramHeight={node.diagram.viewBox.dimensions.h}
                    diagram={node.diagram}
                    showHover={true}
                    name={template.name}
                    onMouseDown={() => {}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (templateId: string) => void;
  onCancel?: () => void;
  title: string;
  label: string;
  templates: DataTemplate[];
};
