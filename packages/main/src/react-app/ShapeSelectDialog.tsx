import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useDiagram, useDocument } from '../application';
import { PickerCanvas } from './PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { useCallback, useRef, useState } from 'react';
import { Stencil, stencilScaleStrokes } from '@diagram-craft/model/stencilRegistry';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { createStencilDiagram, createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { Box } from '@diagram-craft/geometry/box';
import { isEdge } from '@diagram-craft/model/diagramElement';

const SIZE = 35;

// TODO: We should be able to cache this across - both here and ObjectPickerPanel
const NODE_CACHE = new Map<string, Diagram>();

const getDiagram = (props: { diagram: Diagram; onClick: { (): void }; stencil: Stencil }) => {
  const document = props.diagram.document;

  if (NODE_CACHE.has(props.stencil.id)) {
    return NODE_CACHE.get(props.stencil.id)!;
  }

  const { diagram, elements } = createThumbnail(
    d => props.stencil.elementsForCanvas(d),
    document.registry
  );
  const bbox = Box.boundingBox(elements.map(e => e.bounds));
  diagram.viewBox.dimensions = { w: bbox.w + 10, h: bbox.h + 10 };
  diagram.viewBox.offset = { x: -5, y: -5 };

  NODE_CACHE.set(props.stencil.id, diagram);

  return diagram;
};

const StencilView = (props: { stencil: Stencil; diagram: Diagram; onClick: () => void }) => {
  const stencilDiagram = getDiagram(props);

  return (
    <div style={{ background: 'transparent' }} data-width={stencilDiagram.viewBox.dimensions.w}>
      <PickerCanvas
        width={SIZE}
        height={SIZE}
        diagramWidth={stencilDiagram.viewBox.dimensions.w}
        diagramHeight={stencilDiagram.viewBox.dimensions.h}
        diagram={stencilDiagram}
        showHover={true}
        name={props.stencil.name ?? 'unknown'}
        onMouseDown={props.onClick}
        scaleStrokes={stencilScaleStrokes(props.stencil)}
      />
    </div>
  );
};

export const ShapeSelectDialog = (props: Props) => {
  const document = useDocument();
  const diagram = useDiagram();
  const ref = useRef<HTMLInputElement>(null);
  const stencilRegistry = diagram.document.registry.stencils;

  const [search, setSearch] = useState('');
  const [stencils, setStencils] = useState<Stencil[]>([]);

  const doSearch = useCallback(
    (query: string) => {
      setSearch(query);

      if (isEmptyString(query)) {
        setStencils([]);
      } else {
        stencilRegistry.search(query).then(setStencils);
      }
    },
    [stencilRegistry]
  );

  if (!props.open) return <div></div>;

  const recentStencils = document.props.recentStencils.stencils.filter(s => {
    const stencil = stencilRegistry.getStencil(s)!;
    if (!stencil) return false;

    const { diagram: $d } = createStencilDiagram(document.registry);

    const elements = stencil.elementsForPicker($d).elements;

    if (props.excludeMultiElementStencils && elements.length > 1) return false;

    if (elements.length === 1 && !props.includeEdges && isEdge(elements[0])) return false;

    return true;
  });
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
              const stencil = stencilRegistry.getStencil(stencilId);
              if (!stencil) return null;

              return (
                <StencilView
                  key={stencilId}
                  stencil={stencil}
                  diagram={diagram}
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
                doSearch(ref.current?.value ?? '');
              }}
              style={{ flexGrow: 1 }}
            />
            <Button type={'primary'} onClick={() => doSearch(ref.current?.value ?? '')}>
              Search
            </Button>
          </div>

          <div
            className={'cmp-object-picker cmp-shape-select-dialog'}
            style={{ maxWidth: '31rem', marginTop: '1rem', maxHeight: '14rem', overflow: 'auto' }}
          >
            {!isEmptyString(search) &&
              stencils.map(stencil => (
                <StencilView
                  key={stencil.id}
                  stencil={stencil}
                  diagram={diagram}
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
  excludeMultiElementStencils?: boolean;
  includeEdges?: boolean;
};
