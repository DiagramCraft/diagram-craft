import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { TbSearch } from 'react-icons/tb';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { IconifyIconService } from '@diagram-craft/canvas-app/icon/IconifyIconService';
import {
  flattenIcons,
  type CollectionIcons,
  type CollectionInfo,
  type IconService
} from '@diagram-craft/canvas-app/icon/IconService';
import { isEmptyString } from '@diagram-craft/utils/strings';
import styles from './IconPickerTab.module.css';
import { useApplication, useDiagram } from '../../../application';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { IconPickerDrag } from './iconPickerDrag';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

const service: IconService = new IconifyIconService();

const PAGE_SIZE = 30;
const SEARCH_PAGE_SIZE = 60;


const IconGrid = (props: {
  icons: string[];
  getUrl: (icon: string) => string;
  getTooltipUrl?: (icon: string) => string;
  onIconMouseDown?: (event: MouseEvent, prefix: string, icon: string) => void;
  prefix?: string;
}) => {
  const timeout = useRef<number | null>(null);
  const [hover, setHover] = useState<
    { x: number; y: number; url: string; name: string } | undefined
  >();

  const onMouseLeave = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setHover(undefined);
  }, []);

  return (
    <div className={'cmp-object-picker'} onMouseLeave={onMouseLeave}>
      {hover &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              left: hover.x + 40,
              top: hover.y,
              width: 100,
              height: 110,
              zIndex: 200,
              background: 'var(--canvas-bg)',
              borderRadius: '4px',
              lineHeight: '0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: 'var(--canvas-fg)',
              fontSize: '11px',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              boxShadow:
                'hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px'
            }}
          >
            <img src={hover.url} width={80} height={80} />
            <div style={{ lineHeight: '14px', marginTop: 'auto', textAlign: 'center' }}>
              {hover.name}
            </div>
          </div>,
          document.body
        )}
      {props.icons.map(icon => {
        const fullPrefix = props.prefix ?? icon.split(':')[0]!;
        const iconName = props.prefix ? icon : icon.split(':')[1]!;
        return (
          <img
            key={icon}
            className={styles.iconPickerIconItem}
            loading="lazy"
            src={props.getUrl(icon)}
            width={35}
            height={35}
            title={icon}
            onMouseEnter={
              props.getTooltipUrl
                ? e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (timeout.current) clearTimeout(timeout.current);
                    timeout.current = window.setTimeout(() => {
                      setHover({
                        x: rect.x,
                        y: rect.y,
                        url: props.getTooltipUrl!(icon),
                        name: iconName
                      });
                    }, 100);
                  }
                : undefined
            }
            onMouseDown={
              props.onIconMouseDown
                ? e => props.onIconMouseDown!(e.nativeEvent, fullPrefix, iconName)
                : undefined
            }
          />
        );
      })}
    </div>
  );
};

const Pagination = (props: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) => {
  if (props.totalPages <= 1) return null;
  return (
    <div className={styles.iconPickerPagination}>
      <button
        type="button"
        className={styles.iconPickerPaginationBtn}
        disabled={props.page === 0}
        onClick={props.onPrev}
      >
        ‹ Prev
      </button>
      <span>
        {props.page + 1} / {props.totalPages}
      </span>
      <button
        type="button"
        className={styles.iconPickerPaginationBtn}
        disabled={props.page >= props.totalPages - 1}
        onClick={props.onNext}
      >
        Next ›
      </button>
    </div>
  );
};

type CollectionIconsProps = {
  service: IconService;
  prefix: string;
  cachedData: CollectionIcons | undefined;
  onLoad: (prefix: string, data: CollectionIcons) => void;
  onIconMouseDown?: (event: MouseEvent, prefix: string, icon: string) => void;
};

const CollectionIconsPanel = (props: CollectionIconsProps) => {
  const { service, prefix, cachedData, onLoad, onIconMouseDown } = props;
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!cachedData) {
      service.getCollectionIcons(prefix).then(data => onLoad(prefix, data));
    }
  }, [cachedData, prefix, service, onLoad]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: this is intentional to trigger a page reset
  useEffect(() => {
    setPage(0);
  }, [cachedData]);

  if (!cachedData) return <div className={styles.iconPickerLoading}>Loading...</div>;

  const allIcons = flattenIcons(cachedData);
  const totalPages = Math.ceil(allIcons.length / PAGE_SIZE);
  const pageIcons = allIcons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
      <IconGrid
        icons={pageIcons}
        getUrl={icon => service.getIconUrl(prefix, icon, '#fefefe')}
        getTooltipUrl={icon => service.getIconUrl(prefix, icon, '#333333')}
        prefix={prefix}
        onIconMouseDown={onIconMouseDown}
      />
    </>
  );
};

const SearchResultsPanel = (props: {
  service: IconService;
  icons: string[];
  onIconMouseDown?: (event: MouseEvent, prefix: string, icon: string) => void;
}) => {
  const [page, setPage] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: this is intentional to trigger a page reset
  useEffect(() => {
    setPage(0);
  }, [props.icons]);

  const totalPages = Math.ceil(props.icons.length / SEARCH_PAGE_SIZE);
  const pageIcons = props.icons.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE);

  const getUrl = (icon: string) => {
    const [prefix, name] = icon.split(':');
    return props.service.getIconUrl(prefix!, name!, '#fefefe');
  };

  return (
    <>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
      <IconGrid
        icons={pageIcons}
        getUrl={getUrl}
        getTooltipUrl={icon => {
          const [pfx, name] = icon.split(':');
          return props.service.getIconUrl(pfx!, name!, '#333333');
        }}
        onIconMouseDown={props.onIconMouseDown}
      />
    </>
  );
};

export const IconPickerTab = () => {
  const diagram = useDiagram();
  const app = useApplication();
  const [collections, setCollections] = useState<Record<string, CollectionInfo> | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [loadedIcons, setLoadedIcons] = useState<Map<string, CollectionIcons>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  const handleIconMouseDown = useCallback(
    (event: MouseEvent, prefix: string, icon: string) => {
      if (!isRegularLayer(diagram.activeLayer)) return;
      const svgPromise = service.fetchIconSvg(prefix, icon);
      DRAG_DROP_MANAGER.initiate(new IconPickerDrag(event, prefix, icon, svgPromise, diagram, app));

      event.preventDefault();
    },
    [diagram, app]
  );

  useEffect(() => {
    service.getCollections().then(data => setCollections(data));
  }, []);

  const doSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (isEmptyString(query)) {
      setSearchResults([]);
    } else {
      service.searchIcons(query).then(r => setSearchResults(r.icons));
    }
  }, []);

  if (!collections) {
    return (
      <ToolWindow.TabContent>
        <div className={styles.iconPickerLoading}>Loading collections...</div>
      </ToolWindow.TabContent>
    );
  }

  // Group collections by category
  const byCategory = new Map<string, Array<[string, CollectionInfo]>>();
  for (const [prefix, info] of Object.entries(collections)) {
    const cat = info.category ?? 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push([prefix, info]);
  }

  const handleIconLoad = (prefix: string, data: CollectionIcons) => {
    setLoadedIcons(prev => new Map(prev).set(prefix, data));
  };

  return (
    <ToolWindow.TabContent>
      <ToolWindowPanel mode={'headless'} id={'icon-search'} title={'Search'}>
        <div className={'util-hstack'}>
          <TextInput
            ref={ref}
            value={searchQuery}
            style={{ flexGrow: 1 }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                doSearch(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                doSearch('');
                setTimeout(() => {
                  if (ref.current) ref.current.value = '';
                }, 0);
              }
            }}
            onClear={() => doSearch('')}
          />
          <Button type={'secondary'} onClick={() => doSearch(ref.current?.value ?? '')}>
            <TbSearch />
          </Button>
        </div>
      </ToolWindowPanel>

      {!isEmptyString(searchQuery) ? (
        <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
          <SearchResultsPanel
            service={service}
            icons={searchResults}
            onIconMouseDown={handleIconMouseDown}
          />
        </div>
      ) : (
        <Accordion.Root type="multiple" value={openCategories} onValueChange={setOpenCategories}>
          {[...byCategory.entries()]
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([category, entries]) => (
              <Accordion.Item key={category} value={category}>
                <Accordion.ItemHeader>{category}</Accordion.ItemHeader>
                <Accordion.ItemContent forceMount={false}>
                  <div className={styles.iconPickerCollectionList}>
                    {entries
                      .toSorted(([, a], [, b]) => a.name.localeCompare(b.name))
                      .map(([prefix, info]) => (
                        <Collapsible key={prefix} label={info.name}>
                          <CollectionIconsPanel
                            service={service}
                            prefix={prefix}
                            cachedData={loadedIcons.get(prefix)}
                            onLoad={handleIconLoad}
                            onIconMouseDown={handleIconMouseDown}
                          />
                        </Collapsible>
                      ))}
                  </div>
                </Accordion.ItemContent>
              </Accordion.Item>
            ))}
        </Accordion.Root>
      )}
    </ToolWindow.TabContent>
  );
};
