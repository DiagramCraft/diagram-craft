import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useDiagram, useDocument } from '../application';
import { PickerCanvas } from './PickerCanvas';
import { Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addStencilStylesToDocument,
  copyStyles,
  Stencil,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { createStencilDiagram, createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';

const SIZE = 35;

const NODE_CACHE = new Map<string, Diagram>();

const getDiagram = (props: { diagram: Diagram; onClick: { (): void }; stencil: Stencil }) => {
  const document = props.diagram.document;

  if (NODE_CACHE.has(props.stencil.id)) {
    const diagram = NODE_CACHE.get(props.stencil.id)!;
    UnitOfWork.execute(diagram, uow => {
      if (!copyStyles(diagram, document, uow)) {
        uow.abort();
      }
    });
    return diagram;
  }

  const { diagram } = createThumbnail(d => props.stencil.elementsForCanvas(d), document.registry, {
    padding: 5
  });
  UnitOfWork.execute(diagram, uow => {
    addStencilStylesToDocument(props.stencil, document, uow);
    copyStyles(diagram, document, uow);
  });

  NODE_CACHE.set(props.stencil.id, diagram);

  return diagram;
};

const StencilView = (props: { stencil: Stencil; diagram: Diagram; onClick: () => void }) => {
  const stencilDiagram = getDiagram(props);

  return (
    <div style={{ background: 'transparent' }} data-width={stencilDiagram.viewBox.dimensions.w}>
      <PickerCanvas
        size={SIZE}
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
  const redraw = useRedraw();

  useEventListener(diagram.document.styles, 'stylesheetUpdated', () => redraw());

  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to trigger re-render in case document is changed
  useEffect(() => redraw(), [document, redraw]);

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
