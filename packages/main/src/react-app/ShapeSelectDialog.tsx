import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useDiagram, useDocument } from '../application';
import { PickerCanvas } from './PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { assert } from '@diagram-craft/utils/assert';
import { Button } from '@diagram-craft/app-components/Button';
import { useRef, useState } from 'react';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { createThumbnailDiagramForNode } from '@diagram-craft/canvas-app/diagramThumbnail';

const SIZE = 35;

const NODE_CACHE = new Map<string, Diagram>();

const getDiagram = (props: {
  document: DiagramDocument;
  onClick: { (): void };
  stencil: Stencil;
}) => {
  if (NODE_CACHE.has(props.stencil.id)) {
    return NODE_CACHE.get(props.stencil.id)!;
  }

  const { diagram, node } = createThumbnailDiagramForNode(
    d => props.stencil.node(d),
    props.document.definitions
  );
  diagram.viewBox.dimensions = {
    w: node.bounds.w + 10,
    h: node.bounds.h + 10
  };
  diagram.viewBox.offset = { x: -5, y: -5 };

  NODE_CACHE.set(props.stencil.id, diagram);

  return diagram;
};

const StencilView = (props: {
  stencil: Stencil;
  document: DiagramDocument;
  onClick: () => void;
}) => {
  const diagram = getDiagram(props);

  return (
    <div style={{ background: 'transparent' }} data-width={diagram.viewBox.dimensions.w}>
      <PickerCanvas
        width={SIZE}
        height={SIZE}
        diagramWidth={diagram.viewBox.dimensions.w}
        diagramHeight={diagram.viewBox.dimensions.h}
        diagram={diagram}
        showHover={true}
        name={props.stencil.name ?? 'unknown'}
        onMouseDown={props.onClick}
      />
    </div>
  );
};

export const ShapeSelectDialog = (props: Props) => {
  const document = useDocument();
  const diagram = useDiagram();
  const ref = useRef<HTMLInputElement>(null);
  const stencilRegistry = diagram.document.nodeDefinitions.stencilRegistry;

  const [search, setSearch] = useState('');

  if (!props.open) return <div></div>;

  const recentStencils = document.props.recentStencils.stencils;
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={props.title}
      buttons={[{ label: 'Cancel', type: 'cancel', onClick: props.onCancel! }]}
    >
      <Tabs.Root defaultValue={recentStencils.length === 0 ? 'search' : 'recent'}>
        <Tabs.List>
          <Tabs.Trigger value={'recent'}>Recent Shapes</Tabs.Trigger>
          <Tabs.Trigger value={'search'}>Search Shapes</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={'recent'} style={{ height: '16rem' }}>
          <div
            className={'cmp-object-picker cmp-shape-select-dialog'}
            style={{ maxWidth: '30rem' }}
          >
            {recentStencils.map(stencilId => {
              const stencil = stencilRegistry.getStencil(stencilId)!;
              assert.present(stencil, `Stencil ${stencilId} not found`);

              return (
                <StencilView
                  key={stencilId}
                  stencil={stencil}
                  document={document}
                  onClick={() => props.onOk(stencil.id)}
                />
              );
            })}
          </div>
        </Tabs.Content>
        <Tabs.Content value={'search'} style={{ height: '16rem' }}>
          <div className={'util-hstack'}>
            <TextInput
              ref={ref}
              value={search}
              placeholder={'Search shapes...'}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                setSearch(ref.current?.value ?? '');
              }}
              style={{ flexGrow: 1 }}
            />
            <Button type={'primary'} onClick={() => setSearch(ref.current?.value ?? '')}>
              Search
            </Button>
          </div>

          <div
            className={'cmp-object-picker cmp-shape-select-dialog'}
            style={{ maxWidth: '31rem', marginTop: '1rem', maxHeight: '14rem', overflow: 'auto' }}
          >
            {search !== '' &&
              stencilRegistry
                .search(search)
                .map(stencil => (
                  <StencilView
                    key={stencil.id}
                    stencil={stencil}
                    document={document}
                    onClick={() => props.onOk(stencil.id)}
                  />
                ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (stencilId: string) => void;
  onCancel?: () => void;
  title: string;
};
