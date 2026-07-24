import { Dialog } from '@diagram-craft/app-components/Dialog';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { useDiagram, useDocument } from '../application';
import { PickerCanvas } from './PickerCanvas';
import styles from './ShapeSelectDialog.module.css';
import { Diagram } from '@diagram-craft/model/diagram';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TbClock, TbIcons, TbSearch } from 'react-icons/tb';
import { copyStyles, Stencil, stencilScaleStrokes } from '@diagram-craft/model/stencilRegistry';
import { addStencilStylesToDocument } from '@diagram-craft/model/stencilUtils';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { createThumbnailFromStencil } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useRedraw } from './hooks/useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import { type CollectionInfo, flattenIcons } from '@diagram-craft/canvas-app/icon/IconService';
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

const StencilView = (props: {
  stencil: Stencil;
  diagram: Diagram;
  onClick: () => void;
  isSelected?: boolean;
}) => {
  const stencilDiagram = getDiagram(props);

  return (
    <div
      className={styles.eStencilView}
      data-width={stencilDiagram.viewBox.dimensions.w}
      data-selected={props.isSelected ? 'true' : undefined}
    >
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
const ICON_PAGE_SIZE = 4 * 11;
let lastSelectedCollection = '';

const IconsTabContent = (props: {
  onSelect: (data: ShapeSelectResult) => void;
  selectedItem: ShapeSelectResult | null;
}) => {
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
    <div className={styles.icIconsTabs}>
      <div className={'util-hstack'} style={{ gap: '0.5rem' }}>
        <TextInput
          ref={searchRef}
          value={iconSearch}
          variant={'search'}
          placeholder={'Search icons...'}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            doIconSearch(searchRef.current?.value ?? '');
          }}
          style={{ flexGrow: 1, minWidth: '30%' }}
        />
        <Select.Root
          value={selectedCollection}
          onChange={handleCollectionChange}
          placeholder={'All collections'}
          disabled={!iconCollections}
          style={{ maxWidth: '30%' }}
        >
          {sortedCollections.map(([prefix, info]) => (
            <Select.Item key={prefix} value={prefix}>
              {info.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>

      <div className={styles.eIconGrid}>
        <div className={styles.eIconGridInner}>
          {pageIcons.map(icon => {
            const [prefix, name] = safeSplit(icon, ':', 2, 2);
            return (
              <button
                key={icon}
                type="button"
                title={icon}
                className={styles.eItem}
                data-selected={props.selectedItem?.id === icon ? 'true' : undefined}
                onClick={() => props.onSelect({ id: icon, type: 'icon' })}
              >
                <img
                  src={iconService.getIconUrl(prefix, name, '#fefefe')}
                  alt={name}
                  width={35}
                  height={35}
                  className={styles.eItemImage}
                />
              </button>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className={styles.ePagination}>
          {range(0, Math.min(25, totalPages)).map(p => (
            <a
              key={p}
              href={'#'}
              onClick={() => setIconPage(p)}
              data-active={String(p === iconPage)}
              className={styles.eLink}
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
  recent: 'Recent',
  search: 'Search',
  icons: 'Icons'
};

const TAB_ICONS: Record<ShapeSelectTab, ReactElement> = {
  recent: <TbClock />,
  search: <TbSearch />,
  icons: <TbIcons />
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

  const activeTabs = props.tabs ?? (['recent', 'search', 'icons'] as ShapeSelectTab[]);

  const [search, setSearch] = useState('');
  const [stencils, setStencils] = useState<Stencil[]>([]);
  const [mode, setMode] = useState<ShapeSelectTab>(activeTabs[0]!);
  const [selectedItem, setSelectedItem] = useState<ShapeSelectResult | null>(null);

  const handleModeChange = useCallback((newMode: ShapeSelectTab) => {
    setMode(newMode);
    setSelectedItem(null);
  }, []);

  const shouldIncludeStencil = useCallback(
    (stencil: Stencil) => {
      const { elements } = stencil.forPicker(document.registry);

      if (elements.length === 1 && !props.includeEdges && isEdge(elements[0])) return false;

      return true;
    },
    [document.registry, props.includeEdges]
  );

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

  if (!props.open) return null;

  const recentStencils = document.props.recentStencils.stencils
    .map(id => stencilRegistry.getStencil(id))
    .filter((s): s is Stencil => s != null && shouldIncludeStencil(s));

  const stencilGrid = (items: Stencil[]) => (
    <div className={styles.icObjectGrid}>
      <div className={styles.eGrid}>
        {items.map(stencil => (
          <StencilView
            key={stencil.id}
            stencil={stencil}
            diagram={diagram}
            isSelected={selectedItem?.id === stencil.id}
            onClick={() => setSelectedItem({ id: stencil.id, type: 'stencil' })}
          />
        ))}
      </div>
    </div>
  );

  const tabContent: Record<ShapeSelectTab, ReactElement> = {
    recent: stencilGrid(recentStencils),
    search: (
      <>
        <div className={'util-hstack'}>
          <TextInput
            ref={ref}
            value={search}
            variant={'search'}
            placeholder={'Search shapes...'}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              doSearch(ref.current?.value ?? '');
            }}
            style={{ flexGrow: 1 }}
          />
        </div>
        {stencilGrid(!isEmptyString(search) ? stencils.filter(shouldIncludeStencil) : [])}
      </>
    ),
    icons: <IconsTabContent onSelect={setSelectedItem} selectedItem={selectedItem} />
  };

  const dialogBody =
    activeTabs.length === 1 ? (
      <div className={styles.icSingleTabContent}>{tabContent[activeTabs[0]!]}</div>
    ) : (
      <>
        <div style={{ marginBottom: '0.75rem' }}>
          <ModeSwitcher
            modes={activeTabs.map(tab => ({
              value: tab,
              label: TAB_LABELS[tab],
              icon: TAB_ICONS[tab]
            }))}
            value={mode}
            onChange={handleModeChange}
          />
        </div>
        <div style={{ height: '18rem' }}>{tabContent[mode]}</div>
      </>
    );

  const selectedLabel = selectedItem
    ? selectedItem.type === 'stencil'
      ? (stencilRegistry.getStencil(selectedItem.id)?.name ?? selectedItem.id)
      : selectedItem.id
    : undefined;

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={props.title}
      footerLeft={selectedLabel}
      buttons={[
        {
          label: '+ Insert',
          type: 'default',
          disabled: !selectedItem,
          onClick: () => selectedItem && props.onOk(selectedItem)
        },
        { label: 'Cancel', type: 'cancel', onClick: props.onCancel! }
      ]}
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
  includeEdges?: boolean;
  tabs?: ShapeSelectTab[];
};
