import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useDiagram, useDocument } from '../application';
import { PickerCanvas } from './PickerCanvas';
import styles from './ShapeSelectDialog.module.css';
import { Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addStencilStylesToDocument,
  copyStyles,
  Stencil,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { createThumbnailFromStencil } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import { flattenIcons, type CollectionInfo } from '@diagram-craft/canvas-app/icon/IconService';
import { Select } from '@diagram-craft/app-components/Select';
import { range } from '@diagram-craft/utils/array';
import { safeSplit } from '@diagram-craft/utils/safe';

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

  const { diagram } = createThumbnailFromStencil(props.stencil.forCanvas(document.registry), {
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
    <div className={styles.shapeSelectDialogStencilView} data-width={stencilDiagram.viewBox.dimensions.w}>
      <PickerCanvas
        size={SIZE}
        diagram={stencilDiagram}
        showHover={true}
        name={props.stencil.name ?? 'unknown'}
        onMouseDown={props.onClick}
        scaleStrokes={stencilScaleStrokes(props.stencil)}
      />
    </div>
  );
};

const iconService = new IconifyIconService();
const ICON_PAGE_SIZE = 44;
let lastSelectedCollection = '';


const IconsTabContent = (props: { onOk: (data: ShapeSelectResult) => void }) => {
  const [iconCollections, setIconCollections] = useState<Record<string, CollectionInfo> | null>(
    null
  );
  const [selectedCollection, setSelectedCollection] = useState(lastSelectedCollection);
  const [iconSearch, setIconSearch] = useState('');
  const [iconSearchResults, setIconSearchResults] = useState<string[]>([]);
  const [collectionIcons, setCollectionIcons] = useState<string[]>([]);
  const [iconPage, setIconPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    iconService.getCollections().then(setIconCollections);
  }, []);

  // Load icons for the persisted collection on first mount
  useEffect(() => {
    if (lastSelectedCollection) {
      iconService.getCollectionIcons(lastSelectedCollection).then(data => {
        setCollectionIcons(flattenIcons(data).map(name => `${lastSelectedCollection}:${name}`));
      });
    }
  }, []);

  const handleCollectionChange = useCallback(async (prefix: string | undefined) => {
    const p = prefix ?? '';
    setSelectedCollection(p);
    lastSelectedCollection = p;
    setIconPage(0);
    if (p) {
      const data = await iconService.getCollectionIcons(p);
      setCollectionIcons(flattenIcons(data).map(name => `${p}:${name}`));
    } else {
      setCollectionIcons([]);
    }
  }, []);

  const doIconSearch = useCallback((query: string) => {
    setIconSearch(query);
    setIconPage(0);
    if (isEmptyString(query)) {
      setIconSearchResults([]);
    } else {
      iconService.searchIcons(query).then(result => setIconSearchResults(result.icons));
    }
  }, []);

  const sortedCollections = useMemo(
    () =>
      iconCollections
        ? Object.entries(iconCollections).toSorted(([, a], [, b]) => a.name.localeCompare(b.name))
        : [],
    [iconCollections]
  );

  let displayIcons: string[];
  if (!isEmptyString(iconSearch)) {
    displayIcons = isEmptyString(selectedCollection)
      ? iconSearchResults
      : iconSearchResults.filter(i => i.startsWith(`${selectedCollection}:`));
  } else {
    displayIcons = collectionIcons;
  }

  const totalPages = Math.ceil(displayIcons.length / ICON_PAGE_SIZE);
  const pageIcons = displayIcons.slice(iconPage * ICON_PAGE_SIZE, (iconPage + 1) * ICON_PAGE_SIZE);

  return (
    <div className={styles.shapeSelectDialogIconsTab}>
      <div className={'util-hstack'}>
        <TextInput
          ref={searchRef}
          value={iconSearch}
          placeholder={'Search icons...'}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            doIconSearch(searchRef.current?.value ?? '');
          }}
          style={{ flexGrow: 1 }}
        />
        <Button type={'primary'} onClick={() => doIconSearch(searchRef.current?.value ?? '')}>
          Search
        </Button>
        &nbsp;
        <Select.Root
          value={selectedCollection}
          onChange={handleCollectionChange}
          placeholder={'All collections'}
          disabled={!iconCollections}
        >
          {sortedCollections.map(([prefix, info]) => (
            <Select.Item key={prefix} value={prefix}>
              {info.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>

      <div className={styles.shapeSelectDialogIconGrid}>
        <div className={`cmp-object-picker cmp-shape-select-dialog ${styles.shapeSelectDialogIconGridInner}`}>
          {pageIcons.map(icon => {
            const [prefix, name] = safeSplit(icon, ':', 2, 2);
            return (
              <img
                key={icon}
                src={iconService.getIconUrl(prefix, name, '#fefefe')}
                alt={name}
                width={35}
                height={35}
                title={icon}
                className={styles.shapeSelectDialogIconItem}
                onClick={() => props.onOk({ id: icon, type: 'icon' })}
              />
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className={styles.shapeSelectDialogPagination}>
          Page:
          {range(0, totalPages).map(p => (
            <a
              key={p}
              href={'#'}
              onClick={() => setIconPage(p)}
              data-active={String(p === iconPage)}
              className={styles.shapeSelectDialogPaginationLink}
            >
              {p + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export type ShapeSelectResult = { id: string; type: 'stencil' | 'icon' };
export type ShapeSelectTab = 'recent' | 'search' | 'icons';

const TAB_LABELS: Record<ShapeSelectTab, string> = {
  recent: 'Recent Shapes',
  search: 'Search Shapes',
  icons: 'Icons'
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

    const { elements } = stencil.forPicker(document.registry);

    if (props.excludeMultiElementStencils && elements.length > 1) return false;

    if (elements.length === 1 && !props.includeEdges && isEdge(elements[0])) return false;

    return true;
  });

  const activeTabs = props.tabs ?? ['recent', 'search', 'icons'];

  const tabContent: Record<ShapeSelectTab, JSX.Element> = {
    recent: (
      <div className={`cmp-object-picker cmp-shape-select-dialog ${styles.shapeSelectDialogRecentStencils}`}>
        {recentStencils.map(stencilId => {
          const stencil = stencilRegistry.getStencil(stencilId);
          if (!stencil) return null;
          return (
            <StencilView
              key={stencilId}
              stencil={stencil}
              diagram={diagram}
              onClick={() => props.onOk({ id: stencil.id, type: 'stencil' })}
            />
          );
        })}
      </div>
    ),
    search: (
      <>
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
        <div className={`cmp-object-picker cmp-shape-select-dialog ${styles.shapeSelectDialogSearchResults}`}>
          {!isEmptyString(search) &&
            stencils.map(stencil => (
              <StencilView
                key={stencil.id}
                stencil={stencil}
                diagram={diagram}
                onClick={() => props.onOk({ id: stencil.id, type: 'stencil' })}
              />
            ))}
        </div>
      </>
    ),
    icons: <IconsTabContent onOk={props.onOk} />
  };

  const dialogBody =
    activeTabs.length === 1 ? (
      <div className={styles.shapeSelectDialogSingleTabContent}>{tabContent[activeTabs[0]!]}</div>
    ) : (
      <Tabs.Root
        defaultValue={
          activeTabs.includes('recent') && recentStencils.length > 0 ? 'recent' : activeTabs[0]!
        }
      >
        <Tabs.List>
          {activeTabs.map(tab => (
            <Tabs.Trigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {activeTabs.map(tab => (
          <Tabs.Content key={tab} value={tab} style={{ height: '16rem' }}>
            {tabContent[tab]}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    );

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={props.title}
      buttons={[{ label: 'Cancel', type: 'cancel', onClick: props.onCancel! }]}
    >
      {dialogBody}
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (data: ShapeSelectResult) => void;
  onCancel?: () => void;
  title: string;
  excludeMultiElementStencils?: boolean;
  includeEdges?: boolean;
  tabs?: ShapeSelectTab[];
};
