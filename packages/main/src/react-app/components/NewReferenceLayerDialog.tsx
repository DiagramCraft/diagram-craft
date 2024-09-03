import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Diagram } from '@diagram-craft/model/diagram';
import { useEffect, useRef, useState } from 'react';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { Select } from '@diagram-craft/app-components/Select';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      newReferenceLayer: {
        props: Record<string, never>;
        callback: {
          diagramId: string;
          layerId: string;
          name: string;
        };
      };
    }
  }
}

export const ReferenceLayerDialog = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState<Diagram | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<Layer | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });

  const onDiagramChange = (diagram: string | undefined) => {
    setSelectedDiagram(props.diagram.document.getById(diagram!)!);
    setSelectedLayer(null);
  };

  const onLayerChange = (layer: string | undefined) => {
    setSelectedLayer(selectedDiagram!.layers.byId(layer!)!);
  };

  return (
    <Dialog
      open={props.open}
      title={'New reference layer'}
      buttons={[
        {
          type: 'cancel',
          onClick: () => {
            props.onCancel?.();
          },
          label: 'Cancel'
        },
        {
          type: 'default',
          onClick: () => {
            // TODO: Better feedback for missing values
            if (selectedDiagram?.id && selectedLayer?.id && ref.current?.value) {
              props.onCreate?.({
                diagramId: selectedDiagram.id,
                layerId: selectedLayer.id,
                name: ref.current!.value
              });
            }
          },
          label: 'Create'
        }
      ]}
      onClose={props.onCancel ?? (() => {})}
    >
      <div>
        <label>{'Name'}:</label>
        <div className={'cmp-text-input'}>
          <input
            ref={ref}
            type={'text'}
            size={40}
            defaultValue={''}
            onKeyDown={e => {
              // TODO: Why is this needed?
              e.stopPropagation();
            }}
          />
        </div>
      </div>

      <div style={{ paddingTop: '0.5rem' }}>
        <label>{'Reference'}:</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Select.Root
            value={selectedDiagram?.id ?? ''}
            onValueChange={onDiagramChange}
            placeholder={'Sheet'}
          >
            {props.diagram.document.diagrams
              .filter(d => d !== props.diagram)
              .map(d => {
                return (
                  <Select.Item value={d.id} key={d.id}>
                    {d.name}
                  </Select.Item>
                );
              })}
          </Select.Root>

          <Select.Root
            value={selectedLayer?.id ?? ''}
            onValueChange={onLayerChange}
            placeholder={'Layer'}
          >
            {selectedDiagram?.layers.all
              .filter(l => l.type === 'regular')
              .map(l => (
                <Select.Item value={l.id} key={l.id}>
                  {l.name}
                </Select.Item>
              ))}
          </Select.Root>
        </div>
      </div>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onCreate?: (data: { diagramId: string; layerId: string; name: string }) => void;
  onCancel?: () => void;
  diagram: Diagram;
};
